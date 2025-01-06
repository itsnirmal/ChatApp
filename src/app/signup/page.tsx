'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { motion } from 'framer-motion';

const Signup = () => {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSignup = async () => {
    try {
      const response = await fetch('https://chatapp-production-d27a.up.railway.app/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        router.push('/login'); // Redirect to login after successful signup
      } else {
        const data = await response.json();
        setError(data.error || 'Signup failed.');
      }
    } catch (error) {
      console.error('Error during signup:', error);
      setError('An unexpected error occurred.');
    }
  };

  return (
     <div className="h-screen flex justify-center items-center bg-gray-900 text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="w-full max-w-sm p-4 bg-gray-800 rounded-lg shadow-md"
      >
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-2xl font-semibold text-center"
        >
          Signup
        </motion.h1>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-red-500 text-sm mt-2"
          >
            {error}
          </motion.p>
        )}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-4"
        >
          <Input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mb-4"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4"
          />
          <Button
            onClick={handleSignup}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            Signup
          </Button>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-4 text-center"
          >
            Already have an account?{' '}
            <a href="/login" className="text-blue-400 hover:underline">
              Login
            </a>
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Signup;
