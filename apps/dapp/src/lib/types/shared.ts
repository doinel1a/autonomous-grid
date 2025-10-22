import type { FileUIPart, UIMessage } from 'ai';

export type TSendMessage =
  | (Omit<UIMessage, 'id' | 'role'> & {
      id: string | undefined;
      role: 'system' | 'user' | 'assistant' | undefined;
    } & {
      text?: never;
      files?: never;
      messageId?: string;
    })
  | {
      text: string;
      files?: FileList | FileUIPart[];
      metadata?: unknown;
      parts?: never;
      messageId?: string;
    }
  | {
      files: FileList | FileUIPart[];
      metadata?: unknown;
      parts?: never;
      messageId?: string;
    }
  | undefined;
