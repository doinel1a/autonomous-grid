/* eslint-disable @typescript-eslint/restrict-template-expressions */

'use client';

import { useRef, useState } from 'react';

import type React from 'react';

import { Button } from '@heroui/button';
import { Mic, SendHorizonal } from 'lucide-react';

import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type TInput = {
  content: string;
  setContent(content: string): void;
  onSubmit: () => void;
};

export default function Input({ content, setContent, onSubmit }: Readonly<TInput>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaReference = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (content.trim()) {
      setContent('');
      setIsExpanded(false);
      onSubmit();

      if (textareaReference.current) {
        textareaReference.current.style.height = 'auto';
      }
    }
  };

  const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value);

    if (textareaReference.current) {
      textareaReference.current.style.height = 'auto';
      textareaReference.current.style.height = `${textareaReference.current.scrollHeight}px`;
    }

    setIsExpanded(event.target.value.length > 100 || event.target.value.includes('\n'));
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event as React.FormEvent);
    }
  };

  return (
    <form className='group/composer w-full' onSubmit={handleSubmit}>
      <div
        className={cn(
          'dark:bg-muted/50 border-border mx-auto w-full max-w-2xl cursor-text overflow-clip border bg-transparent bg-clip-padding p-2.5 shadow-lg transition-all duration-200',
          {
            'grid grid-cols-1 grid-rows-[auto_1fr_auto] rounded-3xl': isExpanded,
            'grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] rounded-[28px]': !isExpanded
          }
        )}
        style={{
          gridTemplateAreas: isExpanded
            ? "'header' 'primary' 'footer'"
            : "'header header header' 'leading primary trailing' '. footer .'"
        }}
      >
        <div
          className={cn('flex min-h-14 items-center overflow-x-hidden px-1.5', {
            'mb-0 px-2 py-1': isExpanded,
            '-my-2.5': !isExpanded
          })}
          style={{ gridArea: 'primary' }}
        >
          <div className='max-h-52 flex-1 overflow-auto'>
            <Textarea
              ref={textareaReference}
              rows={1}
              value={content}
              placeholder='Ask anything'
              className='placeholder:text-muted-foreground scrollbar-thin min-h-0 resize-none rounded-none border-0 p-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent'
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>

        <div
          className='flex items-center gap-2'
          style={{ gridArea: isExpanded ? 'footer' : 'trailing' }}
        >
          <div className='ms-auto flex items-center gap-2.5'>
            <Button
              type='button'
              variant='light'
              size='sm'
              className='size-10 rounded-full'
              isIconOnly
            >
              <Mic className='text-muted-foreground size-5' />
            </Button>

            {content.trim() && (
              <Button type='submit' size='sm' className='size-10 rounded-full' isIconOnly>
                <SendHorizonal className='size-5' />
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
