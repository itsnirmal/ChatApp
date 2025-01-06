const express = require('express');
const cors = require('cors');
const Pusher = require('pusher');
const Groq = require('groq-sdk');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

dotenv.config();

const app = express();
const port = 3001;

const allowedOrigins = [
    'http://localhost:3000',
    'https://chatrix.vercel.app',
    'https://chatapp-production-d27a.up.railway.app',
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error(`Blocked by CORS: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  
    allowedHeaders: ['Content-Type', 'Authorization'],     
}));

app.options('*', cors());

app.use(express.json());




mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true });

const messageSchema = new mongoose.Schema({
  user: { type: String, required: true },
  message: { type: String, required: true },
  botResponse: { type: String },
  code: { type: String, required: true},
  timestamp: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const roomSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const Message = mongoose.model('Message', messageSchema);
const User = mongoose.model('User', userSchema);
const Room = mongoose.model('Room', roomSchema);

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access Denied.' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid Token.' });
    req.user = user;
    next();
  });
};

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_APP_KEY,
  secret: process.env.PUSHER_APP_SECRET,
  cluster: process.env.PUSHER_APP_CLUSTER,
  useTLS: true,
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.get('/', (req, res) => {
  res.send('Welcome to the Chatrix Chat App!');
});

// Token validation endpoint
app.get('/validate-token', authenticateToken, (req, res) => {
  res.status(200).json({ username: req.user.username, userId: req.user.userId, });
});

app.get('/messages', authenticateToken, async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send({ error: 'Chat code is required.' });

  try {
    const messages = await Message.find({ code }).sort({ timestamp: 1 });
    res.status(200).send(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).send({ error: 'Failed to fetch messages.' });
  }
});

app.get('/joined-rooms', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    // Fetch rooms where the user is a member or creator
        const rooms = await Room.find({
            $or: [
                { creator: userId },
                { members: userId }
            ]
        });
    return res.status(200).json({ rooms });
  } catch (error) {
    console.error('Error fetching joined rooms:', error);
    return res.status(500).json({ error: 'Failed to fetch joined rooms.' });
  }
});

// GET /all-rooms: returns all rooms the user created or joined
app.get('/all-rooms', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find all rooms where creator == userId OR members includes userId
    const allRooms = await Room.find({
      $or: [
        { creator: userId },
        { members: userId },
      ],
    });

    // (Optional) remove duplicates if a user is both creator AND member
    // Map by room.code (or _id)
    const uniqueRooms = [
      ...new Map(allRooms.map((room) => [room.code, room])).values(),
    ];

    res.status(200).json({ rooms: uniqueRooms });
  } catch (error) {
    console.error('Error fetching all rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms.' });
  }
});

app.post('/register', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters long.'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ error: 'Username already exists.' });

    const user = new User({ username, password });
    await user.save();
    res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user.' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    res.status(200).json({ token, user: { username: user.username } });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to log in.' });
  }
});

app.post('/message', authenticateToken, async (req, res) => {
  try {
    const { user, message, code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Chat room code is required.' });
    }

    let botResponse = '';
    if (message.toLowerCase().includes('/help')) {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'you are a helpful assistant.' },
          { role: 'user', content: `Respond to the customers query:${message}` },
        ],
        model: 'llama3-8b-8192',
        max_tokens: 1024,
      });
      console.log('Response:', chatCompletion.choices[0]?.message.content);
      botResponse = chatCompletion.choices[0]?.message.content;
    }

    const newMessage = await Message.create({ user, message, botResponse, code });
    pusher.trigger(`room-${code}`, 'new-message', {
      user: newMessage.user,
      message: newMessage.message,
      botResponse: newMessage.botResponse,
      timestamp: newMessage.timestamp,
    });

    res.status(200).send({ success: true });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).send({ success: false, error: 'Failed to process message.' });
  }
});


app.post('/create-room', authenticateToken, async (req, res) => {
  const { code, name } = req.body; // Room code sent from frontend
  const userId = req.user.userId; // Extract userId from authenticated token

  if (!code || !name) {
    return res.status(400).json({ error: 'Chat code and name are required.' });
  }

  try {
    // Check if a room with the same code already exists
    const existingRoom = await Room.findOne({ code });
    if (existingRoom) {
      return res.status(400).json({ error: 'Chat code already exists.' });
    }

    // Create the new room with the current user as the creator
    const room = new Room({
      code,
      name,
      creator: userId,
      members: [userId], // Optionally add creator as a member
    });
    await room.save();

    // Notify via Pusher (optional, if used for real-time updates)
    pusher.trigger('rooms', 'new-room', { code, name });

    // Return room details, including the creator
    res.status(201).json({
      message: 'Chat room created successfully.',
      code: room.code, name: room.name, creator: room.creator,
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room.' });
  }
});


app.delete('/delete-room', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Chat room code is required.' });
    }

    // Find the room by code
    const room = await Room.findOne({ code });
    if (!room) {
      return res.status(404).json({ error: 'Chat room not found.' });
    }

    // Check if the user requesting deletion is actually the creator of the room
    if (room.creator.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only creater can delete this room.' });
    }

    // Optionally, also delete messages associated with this room:
    await Message.deleteMany({ code });

    // Finally, delete the room
    await Room.deleteOne({ code });

    res.status(200).json({ message: 'Room deleted successfully.' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room.' });
  }
});


// Endpoint to validate chat room access
app.post('/validate-room', authenticateToken, async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Chat code is required.' });
  }

  try {
    const room = await Room.findOne({ code });
    if (!room) {
      return res.status(404).json({ error: 'Chat room not found.' });
    }

    res.status(200).json({ message: 'Access granted.' });
  } catch (error) {
    console.error('Error validating room:', error);
    res.status(500).json({ error: 'Failed to validate room.' });
  }
});

app.post('/join-room', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.userId;

    // 1. Find the room by code
    const room = await Room.findOne({ code });
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    // 2. If not already a member, add them
    if (!room.members.includes(userId)) {
      room.members.push(userId);
      await room.save();
    }

    return res.status(200).json({ message: 'Successfully joined the room.' });
  } catch (error) {
    console.error('Error joining room:', error);
    return res.status(500).json({ error: 'Failed to join the room.' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
