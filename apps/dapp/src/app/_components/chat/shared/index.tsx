'use client';

import type { TSendMessage } from '@/lib/types/shared';
import type { UIMessage } from 'ai';

import { Separator } from '@/components/ui/separator';

import Input from './input';
import Message from './message';

type TChat = {
  input: string;
  messages: UIMessage[];
  setInput(content: string): void;
  onChatSubmit: () => void;
  sendMessage: (message: TSendMessage) => Promise<void>;
};

export default function Chat({
  input,
  messages,
  setInput,
  onChatSubmit,
  sendMessage
}: Readonly<TChat>) {
  return (
    <section className='bg-secondary/50 grid w-full grid-rows-[1fr_auto] overflow-hidden rounded-t-lg'>
      <div className='overflow-y-auto px-2.5 pt-2.5'>
        <ul className='flex w-full flex-col gap-y-2.5'>
          {messages.map((message, index) => (
            <li key={index} className='flex gap-2'>
              <Message key={index} message={message} sendMessage={sendMessage} />
            </li>
          ))}
        </ul>
      </div>

      <Separator className='my-2.5' />

      <div className='px-2.5 pb-2.5'>
        <Input content={input} setContent={setInput} onSubmit={onChatSubmit} />
      </div>
    </section>
  );
}
