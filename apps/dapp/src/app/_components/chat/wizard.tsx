'use client';

import { useEffect, useState } from 'react';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAccount } from 'wagmi';

import useIsMounted from '@/hooks/use-is-mounted';
import { apiRoute } from '@/lib/constants/shared';

import Chat from './shared';

export default function WizardChat() {
  const isMounted = useIsMounted();
  const { isConnecting, isReconnecting, isConnected, address } = useAccount();
  const [input, setInput] = useState('');
  const { messages, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: apiRoute.wizard
    })
  });

  const onChatSubmit = () => {
    void sendMessage({ text: input });
  };

  useEffect(() => {
    if (isMounted() && !isConnecting && !isReconnecting && isConnected && messages.length === 0) {
      // Start conversation providing user's wallet address
      void sendMessage({ text: `My wallet address is ${address}.` });
    }
  }, [isMounted, isConnecting, isReconnecting, isConnected, address, messages, sendMessage]);

  return (
    <Chat
      input={input}
      messages={messages.slice(1)}
      setInput={setInput}
      onChatSubmit={onChatSubmit}
      sendMessage={sendMessage}
    />
  );
}
