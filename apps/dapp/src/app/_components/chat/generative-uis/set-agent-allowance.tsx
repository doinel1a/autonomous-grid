/* eslint-disable @typescript-eslint/restrict-template-expressions */

'use client';

import { useState } from 'react';

import type { TEnergyProfile } from '@/lib/constants/shared';
import type { TSendMessage } from '@/lib/types/shared';
import type { Address } from 'viem';

import { Button } from '@heroui/button';
import { parseUnits } from 'viem';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { Separator } from '@/components/ui/separator';
import { env } from '@/env';
import {
  ABI as PYUSD_ABI,
  CONTRACT_ADDRESS as PYUSD_CONTRACT_ADDRESS
} from '@/lib/constants/contracts/paypal-usd';
import { energyProfile } from '@/lib/constants/shared';
import { cn } from '@/lib/utils';

import Input from './shared/input';

type TSetAgentAllowance = {
  userAddress: Address;
  userEnergyProfile: TEnergyProfile;
  className?: string;
  sendMessage: (message: TSendMessage) => Promise<void>;
};

export default function SetAgentAllowance({
  userAddress,
  userEnergyProfile,
  className,
  sendMessage
}: Readonly<TSetAgentAllowance>) {
  const isProducer = userEnergyProfile === energyProfile.producer;

  const { address: connectedAddress } = useAccount();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { isPending, data: hash, writeContract } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleApprove = async () => {
    if (isProducer) {
      return;
    }

    setError(null);

    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (connectedAddress?.toLowerCase() !== userAddress.toLowerCase()) {
      setError('Connected wallet does not match user address');
      return;
    }

    try {
      const agentAddress = getAgentAddressByEnergyProfile(userEnergyProfile);
      const amountInWei = parseUnits(amount, 6);
      writeContract({
        address: PYUSD_CONTRACT_ADDRESS,
        abi: PYUSD_ABI,
        functionName: 'approve',
        args: [agentAddress, amountInWei]
      });
    } catch (error_) {
      console.error('CLIENT ERROR: Error preparing transaction', error_);
      setError(error_ instanceof Error ? error_.message : 'Failed to prepare transaction');
    }
  };

  if (!isProducer && isSuccess && hash) {
    void sendMessage({
      text: `Transaction successful! Hash: ${hash}. I approved ${amount} PYUSD for the agent.`
    });
  }

  if (isProducer) {
    return null;
  }

  return (
    <div className={cn('', className)}>
      <form className='flex flex-col gap-y-2.5'>
        <Input
          value={amount}
          placeholder='Enter PYUSD amount'
          endAddon='PYUSD'
          disabled={isPending || isLoading || isSuccess}
          setValue={setAmount}
        />

        {error && (
          <div className='rounded bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400'>
            {error}
          </div>
        )}

        {hash && (
          <div className='rounded bg-blue-50 p-2 text-sm dark:bg-blue-900/20'>
            <span className='font-medium'>Transaction Hash:</span>
            <a
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target='_blank'
              rel='noopener noreferrer'
              className='ml-1 font-mono text-xs text-blue-600 hover:underline dark:text-blue-400'
            >
              {hash.slice(0, 10)}...{hash.slice(-8)}
            </a>
          </div>
        )}

        <Button
          type='button'
          color='primary'
          className='ml-auto mt-2.5 w-fit text-white'
          isDisabled={isPending || isLoading || isSuccess}
          isLoading={isPending || isLoading}
          onPress={handleApprove}
        >
          Approve
        </Button>
      </form>

      <Separator className='my-2.5' />
    </div>
  );
}

function getAgentAddressByEnergyProfile(userEnergyProfile: TEnergyProfile): Address {
  switch (userEnergyProfile) {
    case energyProfile.consumer: {
      return env.NEXT_PUBLIC_CONSUMER_AGENT_WALLET as Address;
    }
    case energyProfile.producer: {
      return env.NEXT_PUBLIC_PRODUCER_AGENT_WALLET as Address;
    }
    case energyProfile.prosumer: {
      return env.NEXT_PUBLIC_PROSUMER_AGENT_WALLET as Address;
    }
    default: {
      throw new Error(`Unknown energy profile: ${userEnergyProfile}`);
    }
  }
}
