'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from './ui/button'; // Replace with Shadcn Button import
import { MessageSquare } from 'lucide-react';

const HomeComponent: React.FC = () => {
  const router = useRouter();

  const handleExplore = () => {
    router.push('/signup'); // Redirect to the chat discovery or explore page
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="p-6 bg-gray-800 rounded-lg shadow-lg text-center"
      >
        <MessageSquare size={56} className="text-blue-500 mb-4 mx-auto" />
        <h1 className="text-2xl font-semibold mb-4">Chatrix</h1>
        <p className="mb-6">Dive into conversations</p>
        <Button type="button" onClick={handleExplore} className="w-full bg-blue-600 hover:bg-blue-700">
          Explore Now
        </Button>
        <div className="mt-4">
          <p>
            Already have an account?{' '}
            <a href="/login" className="text-blue-400 hover:underline">
              Login
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default HomeComponent;
