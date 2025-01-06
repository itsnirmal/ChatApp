'use client';

import ChatBox from '../../components/ChatBox';
import React, { Suspense } from 'react';

export default function ChatPage() {
  return (
    <Suspense fallback={<p>Loading chat...</p>}>
        <ChatBox />
    </Suspense>
);
}
