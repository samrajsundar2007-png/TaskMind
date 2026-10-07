import React from 'react';
import { ChatPanel } from '../components/chat/ChatPanel';

export const ChatView: React.FC = () => {
  return (
    <div className="h-[calc(100vh-8.5rem)] lg:h-[calc(100vh-9.5rem)]">
      <ChatPanel />
    </div>
  );
};
