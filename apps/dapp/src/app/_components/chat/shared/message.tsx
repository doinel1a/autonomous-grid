/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable unicorn/no-nested-ternary */
/* eslint-disable sonarjs/no-nested-conditional */

import type { TEnergyProfile } from '@/lib/constants/shared';
import type { TSendMessage } from '@/lib/types/shared';
import type { UIMessage } from '@ai-sdk/react';
import type { Address } from 'viem';

import { User, Zap } from 'lucide-react';

import { partToolName } from '@/lib/constants/shared';
import { cn } from '@/lib/utils';

import EnergyProfileForm from '../generative-uis/energy-profile-form';
import SelectEnergyProfile from '../generative-uis/select-energy-profile';
import SetAgentAllowance from '../generative-uis/set-agent-allowance';
import { Markdown } from './markdown';

type TMessage = {
  message: UIMessage;
  sendMessage: (message: TSendMessage) => Promise<void>;
};

export default function Message({ message, sendMessage }: Readonly<TMessage>) {
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={cn('flex w-full flex-row-reverse items-start gap-x-2.5', {
        'flex-row': isAssistant
      })}
    >
      <Avatar role={message.role} />

      <div className='bg-muted/50 my-auto h-fit w-full rounded-md border p-2'>
        {message.parts.map((part, index) =>
          part.type === 'text' ? (
            <Markdown key={index}>{part.text}</Markdown>
          ) : part.type === partToolName.wizard.start ? (
            part.state === 'input-available' ? (
              <span key={index}>Loading...</span>
            ) : part.state === 'output-available' ? (
              <SelectEnergyProfile key={index} sendMessage={sendMessage} />
            ) : null
          ) : part.type === partToolName.wizard.getEnergyData ? (
            part.state === 'input-available' ? (
              <span key={index}>Loading...</span>
            ) : part.state === 'output-available' ? (
              <EnergyProfileForm
                key={index}
                // @ts-expect-error No problem
                energyProfile={part.input.energyProfile as TEnergyProfile}
                sendMessage={sendMessage}
              />
            ) : null
          ) : part.type === partToolName.wizard.saveEnergyData ? (
            part.state === 'input-available' ? (
              <span key={index}>Loading...</span>
            ) : part.state === 'output-available' ? (
              <SetAgentAllowance
                key={index}
                // @ts-expect-error No problem
                userAddress={part.input.address as Address}
                // @ts-expect-error No problem
                userEnergyProfile={part.input.energyProfile as TEnergyProfile}
                sendMessage={sendMessage}
              />
            ) : null
          ) : null
        )}
      </div>
    </div>
  );
}

type TAvatar = {
  role: UIMessage['role'];
};

function Avatar({ role }: Readonly<TAvatar>) {
  const isAssistant = role === 'assistant';
  const isUser = role === 'user';

  return (
    <div className='bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full border'>
      {isAssistant ? (
        <Zap className='size-6 fill-yellow-400' />
      ) : isUser ? (
        <User className='size-6 fill-blue-500' />
      ) : null}
    </div>
  );
}
