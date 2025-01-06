'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { initializePusher } from '../utils/pusherClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from './ui/input'; 
import { Button } from './ui/button'; 
import { motion } from 'framer-motion';
import Spline from '@splinetool/react-spline';
import { Bot, Copy, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useRef } from 'react';
import { Menu } from 'lucide-react';

interface Message {
  _id?: string;
  user: string;
  message: string;
  botResponse?: string;
  timestamp: string;
}


interface ChatRoom {
  code: string;
  creator: string;
  name: string;
}

interface DeleteRoomResponse {
  ok: boolean;
}


interface ValidateRoomAccessResponse {
        ok: boolean;
}


const ChatBox = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatCode = searchParams.get('code');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true); // To show a loading state while validating token
  const [error, setError] = useState('');
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(chatCode);
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [userId, setUserId] = useState('');
  const [chatName, setChatName] = useState('');
  const [includeHelp, setIncludeHelp] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);  // State to toggle menu visibility


  const logout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  const copyToClipboard = async (code: string) => {
    try {
        await navigator.clipboard.writeText(code);
        toast.success('Chat code copied to clipboard!', {
            icon: '✅',
            style: {
                borderRadius: '10px',
                background: '#333',
                color: '#fff',
            },
        });
    } catch (error) {
        console.error('Failed to copy:', error);
        toast.error('Failed to copy chat code.', {
            icon: '❌',
            style: {
                borderRadius: '10px',
                background: '#333',
                color: '#fff',
            },
        });
    }
};

  const fetchJoinedChats = async (token: string) => {
    try {
      const response = await fetch('https://chatapp-production-d27a.up.railway.app/joined-rooms', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setChats(data.rooms);
        if (!selectedChat && data.rooms.length > 0) {
          setSelectedChat(data.rooms[0].code); // Select the first chat by default
        }
      }
      else {
      console.error('Failed to fetch joined chats:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching joined chats:', error);
    }
  };

  const fetchMessages = async (chatCode: string, token: string) => {
    try {
      const response = await fetch(`https://chatapp-production-d27a.up.railway.app/messages?code=${chatCode}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data: Message[] = await response.json();
        setMessages(data);
      }
      else {
      console.error('Failed to fetch messages:', response.statusText);
      setError('Failed to fetch messages. Please try again later.');
    }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to fetch messages. Please try again later.');
    }
  };

  const handleCreateChat = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    if (!chatName.trim()) {
        alert('Please enter a chat name.');
        return;
    }

    const randomCode = Math.random().toString(36).substr(2, 8);

    try {
      const response = await fetch('https://chatapp-production-d27a.up.railway.app/create-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: randomCode, name: chatName }),
      });

      if (response.ok) {
        const data = await response.json();
        setChats((prev) => [...prev, { code: data.code, name:data.name, creator: data.creator }]);
        setSelectedChat(data.code); // Automatically select the new chat
        toast.success('Successfully created the room!', {
            icon: '✅',
            style: {
                borderRadius: '10px',
                background: '#333',
                color: '#fff',
            },
        });

      }
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  useEffect(() => {
    scrollToBottom();  // Scroll on every message update
}, [messages]);


  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const response = await fetch('https://chatapp-production-d27a.up.railway.app/validate-token', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setUserName(data.username);
          setUserId(data.userId);
          await fetchAllRooms(token);
          setLoading(false);
        } else {
          localStorage.removeItem('token');
          router.push('/login');
        }
      } catch (error) {
        console.error('Error validating token:', error);
        localStorage.removeItem('token');
        router.push('/login');
      }
    };

    validateToken();
  }, [router]);

        useEffect(() => {
        if (selectedChat) {
          validateRoomAccess(selectedChat);
        }
      }, [selectedChat]);

      useEffect(() => {
      // If we are still loading or no chat is selected, do nothing
      if (loading || !selectedChat) return;

      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Clear old messages, then fetch new ones
      setMessages([]);
      fetchMessages(selectedChat, token);

      // Set up Pusher for real-time updates
      const pusher = initializePusher();
      // IMPORTANT: subscribe to `room-{selectedChat}` and unsubscribe from the same
      const channel = pusher.subscribe(`room-${selectedChat}`);

      channel.bind('new-message', (data: Message) => {
        setMessages((prev) => [...prev, data]);
      });

      return () => {
        // Unsubscribe from the exact channel name
        pusher.unsubscribe(`room-${selectedChat}`);
      };
    }, [loading, selectedChat, router]);

    useEffect(() => {
  const savedChat = localStorage.getItem('selectedChat');
  if (savedChat) setSelectedChat(savedChat);
}, []);


  const sendMessage = async () => {
    if (!input) return;

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Check if /help should be included
    const messageToSend = includeHelp ? `/help ${input}` : input;

    await fetch('https://chatapp-production-d27a.up.railway.app/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user: userName, message: messageToSend, code: selectedChat }),
    });
    setInput('');
    scrollToBottom();
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
};


      const validateRoomAccess = async (roomCode: string): Promise<void> => {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        try {
          const response: ValidateRoomAccessResponse = await fetch(`https://chatapp-production-d27a.up.railway.app/validate-room`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ code: roomCode }),
          });

          if (response.ok) {
            console.log('Access granted to room.');
          } else {
            setError('Access to this chat room is restricted.');
          }
        } catch (error) {
          console.error('Error validating room access:', error);
          setError('Failed to validate room access.');
        }
      };


const handleDeleteRoom = async (roomCode: string): Promise<void> => {
  const token = localStorage.getItem('token');
  if (!token) {
    router.push('/login');
    return;
  }

  try {
    const response: DeleteRoomResponse = await fetch(`https://chatapp-production-d27a.up.railway.app/delete-room`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: roomCode }),
    });

    if (response.ok) {
      setChats((prev) => prev.filter((room) => room.code !== roomCode));
      setMessages([]);
      if (selectedChat === roomCode) {
        setSelectedChat(null); // Deselect if the current room is deleted
        toast.success('Successfully deleted the room!', {
            icon: '✅',
            style: {
                borderRadius: '10px',
                background: '#333',
                color: '#fff',
            },
        });
      }
      
    } else {
       toast.error('Failed to delete room.');
    }
  } catch (error) {
    console.error('Error deleting room:', error);
  }
};
const joinRoom = async (roomCode: string) => {
  const token = localStorage.getItem('token');
  if (!token) {
    router.push('/login');
    return;
  }

  try {
    const response = await fetch('https://chatapp-production-d27a.up.railway.app/join-room', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: roomCode }),
    });

    if (response.ok) {
      console.log('Successfully joined the room');
      // Refetch joined chats to update the list
      await fetchJoinedChats(token);
    } else {
      console.error('Failed to join the room', response.statusText);
    }
  } catch (error) {
    console.error('Error joining the room:', error);
  }
};

const fetchAllRooms = async (token: string) => {
  try {
    const response = await fetch('https://chatapp-production-d27a.up.railway.app/all-rooms', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      // data.rooms is the array from the server
      console.log('All Rooms:', data.rooms); // Debugging
      setChats(data.rooms);

      // Optionally auto-select the first room if none is selected
      if (!selectedChat && data.rooms.length > 0) {
        setSelectedChat(data.rooms[0].code);
      }
    } else {
      console.error('Failed to fetch all rooms:', response.statusText);
    }
  } catch (error) {
    console.error('Error fetching all rooms:', error);
  }
};

  if (loading) {
    return (
      <div className="h-screen bg-gray-900 text-white flex justify-center items-center">
        <h1 className="text-xl font-semibold">Loading...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-gray-900 text-white flex justify-center items-center">
        <h1 className="text-xl font-semibold">{error}</h1>
      </div>
    );
  }
  return (
    <div className='text-white flex flex-col h-screen'>
      <Toaster position="top-right" reverseOrder={false} />

      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex justify-between items-center p-4 bg-gray-800 shadow"
      >
        <h1 className="text-xl font-semibold">Sentiment Chat</h1>
        
        {/* Hamburger Menu Icon (visible on small screens) */}
        <Menu
          size={28}
          className="cursor-pointer md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
        />

        {/* Logout Button */}
        <div className="hidden md:flex items-center">
          <span className="mr-4">Welcome, {userName}!</span>
          <Button onClick={logout} className="bg-red-600 hover:bg-red-700 text-sm">
            Logout
          </Button>
        </div>
      </motion.div>

      {/* Main Container */}
      <div className="flex flex-1 h-full bg-gray-900 text-white">
        {/* Left Panel */}
        <div
                className={`fixed inset-0 z-50 bg-gray-900/80 backdrop-blur-lg p-6 transition-transform duration-300 ease-in-out ${
                    menuOpen ? 'translate-x-0' : '-translate-x-full'
                } md:relative md:w-1/3 md:translate-x-0`}
            >
               {/* Close Button for Mobile */}
                <div className="flex justify-end md:hidden mb-4">
                    <X onClick={() => setMenuOpen(false)} size={24} className="cursor-pointer">
                        Close
                    </X>
                </div>
          <h2 className="text-xl font-semibold">Create a room</h2>
          {/* Create Chat Form */}
          <div className="flex items-center justify-between mt-4 ">
              <Input
                  value={chatName}
                  onChange={(e) => setChatName(e.target.value)}
                  placeholder="Enter chat name"
                  className="mb-2 w-full"
              />
              <Button onClick={handleCreateChat} className="mb-4 bg-blue-600 hover:bg-blue-700 ml-4">
                Create
              </Button>   
          </div>
          <hr className="border-gray-700 w-full mt-4 mb-4" />
          <h2 className="text-xl font-semibold">Join a room</h2>
          {/* Join Chat Form */}
          <div className='flex items-center justify-between mt-4'>
              <Input
              value={joinRoomCode}
              onChange={(e) => setJoinRoomCode(e.target.value)}
              placeholder="Enter a room code"
              className="mb-2 w-full"
            />
            <Button onClick={() => joinRoom(joinRoomCode)}
              className="bg-blue-600 hover:bg-blue-700 ml-4">
              Join
            </Button>
          </div>
          <hr className="border-gray-700 w-full mt-4 mb-4" />
          <h2 className="text-xl font-semibold mb-4">Rooms</h2>
          {/* List of Chats */}
          <ul className="flex flex-col overflow-y-auto space-y-2">
              {chats.map((chat) => {
                return (
                <li
                  key={chat.code}
                  onClick={() => {
                    setSelectedChat(chat.code); // Update selectedChat
                  }}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                    chat.code === selectedChat ? 'bg-blue-500' : 'bg-gray-700'
                  } hover:${chat.code === selectedChat ? 'bg-blue-600' : 'bg-gray-800'}`}
                >
                    <span className="font-semibold">{chat.name}</span>

                    <div className="flex items-center space-x-2">
                      <span className={`mr-2 ${
                        chat.creator === userId ? 'text-green-500' : 'text-yellow-400'
                      }`}>
                      {chat.creator === userId ? '[Creator]' : '[Member]'}
                    </span>
                        {/* Copy Chat Code Icon */}
                        <Copy
                              onClick={(e) => {
                                  e.stopPropagation(); // Prevent selecting the chat while copying
                                  copyToClipboard(chat.code);
                              }}
                              size={20}
                              className="cursor-pointer text-gray-300 hover:text-white transition duration-300"
                          />
                        {/* Delete Button */}
                        {chat.creator === userId && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent selecting the chat when clicking Delete
                              handleDeleteRoom(chat.code);
                            }}
                            className="bg-red-600 hover:bg-red-700"
                            variant="destructive" 
                            size={'sm'}
                          >
                            Delete
                          </Button>
                        )}
                    </div>
                </li>
              );
            })}
            </ul>
        </div>

        {/* Chatbox UI */}
        <div className="relative w-full md:w-2/3 flex flex-col h-full">
          {/* Messages Section */}
          {selectedChat ? (
            <>
                <div className="inset-0 z-10 flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg, idx) => (
                    <React.Fragment key={idx}>
                      {/* User's Message */}
                      <motion.div
                        initial={{ opacity: 0, x: msg.user === userName ? 50 : -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`flex ${msg.user === userName ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`p-3 max-w-xs rounded-lg shadow ${
                            msg.user === userName ? 'bg-blue-600 text-right' : 'bg-gray-700 text-left'
                          }`}
                        >
                          <strong>{msg.user}: </strong>
                          {msg.message}
                        </div>
                      </motion.div>

                      {/* AI's Response */}
                      {msg.botResponse && (
                        <motion.div
                          initial={{ opacity: 0, x: -50 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3 }}
                          className="flex justify-start"
                        >
                          <div className="flex items-end">
                            <div className="rounded-full bg-purple-600 p-2 mr-2">
                              <Bot />
                            </div>
                            <div className="p-3 max-w-xs rounded-2xl shadow bg-purple-700 text-left">
                              <p className="text-left leading-5 whitespace-pre-wrap">{msg.botResponse}</p>
                            </div>
                          </div>
                        </motion.div>
                        
                      )}
                      <div ref={messagesEndRef}></div>
                    </React.Fragment>
                  ))}
                </div>
                <div className="absolute inset-0 z-0">
                  <Spline scene="https://prod.spline.design/A0Gc1Aru-dGTYzpT/scene.splinecode"/>
                </div>
                {/* Input Section */}
                <div className="flex p-4 bg-steel-900/80 inset-0 z-10 backdrop-blur-md">
                  <Input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type your message..."
                    className="flex-1"
                  />
                 {/* /help Toggle Switch */}
                <label className="flex items-center ml-4 cursor-pointer">
                    <div
                        className={`relative w-10 h-6 transition-all duration-300 rounded-full ${
                            includeHelp ? 'bg-blue-500' : 'bg-gray-600'
                        }`}
                        onClick={() => setIncludeHelp(!includeHelp)}
                    >
                        {/* Toggle Circle */}
                        <div
                            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ${
                                includeHelp ? 'translate-x-4' : 'translate-x-0'
                            }`}
                        />
                    </div>
                    <span className="ml-3 text-sm text-gray-300">
                        {includeHelp ? 'AI Enabled' : 'Enable AI'}
                    </span>
                </label>
                  <Button onClick={sendMessage} className="ml-2 bg-blue-600 hover:bg-blue-700">
                    Send
                  </Button>
                </div>
            </> 
            ) : (
              <div className="flex-1 flex justify-center items-center">
              <h2 className="text-xl font-semibold text-gray-400">It's so empty here...</h2>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
