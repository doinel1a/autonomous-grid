/* eslint-disable @typescript-eslint/restrict-template-expressions */

import type { TEnergyProfile } from '@/lib/constants/shared';
import type { Address } from 'viem';

import { tool } from 'ai';
import { parseUnits } from 'viem';
import z from 'zod';

import { env } from '@/env';
import {
  ABI as PY_USD_ABI,
  CONTRACT_ADDRESS as PYUSD_CONTRACT_ADDRESS
} from '@/lib/constants/contracts/paypal-usd';
import { energyProfile as energyProfileConstant } from '@/lib/constants/shared';
import { address, energyProfile } from '@/lib/schemas/shared';

export const setAllowanceTool = tool({
  description:
    "Request user's permission to allow AI agents to spend PYUSD tokens on their behalf for energy trading. This creates an allowance for the agent to make transactions.",
  inputSchema: z.object({
    energyProfile,
    userAddress: address('The user address from the chat context'),
    amount: z.number().positive().describe('Amount of PYUSD to approve for the agent to spend')
  }),
  execute: async ({ energyProfile, userAddress, amount }) => {
    console.log('SERVER - Allowance request:', {
      energyProfile,
      userAddress,
      amount
    });

    try {
      const agentAddress = getAgentAddressByEnergyProfile(energyProfile);
      const amountInWei = parseUnits(amount.toString(), 6);

      console.log('SERVER - Agent address:', agentAddress);
      console.log('SERVER - Amount in wei:', amountInWei.toString());

      return {
        success: true,
        message: `
          To allow the ${energyProfile} agent to spend **${amount} PYUSD** on your behalf, please approve the transaction in your wallet.

          **Agent Address:** \`${agentAddress}\`
          **Contract:** \`${PYUSD_CONTRACT_ADDRESS}\`
          **Amount:** ${amount} PYUSD

          This allowance will enable the agent to automatically purchase energy for you when needed.
        `,
        transactionData: {
          contractAddress: PYUSD_CONTRACT_ADDRESS,
          agentAddress,
          amount: amountInWei.toString(),
          abi: PY_USD_ABI,
          functionName: 'approve',
          args: [agentAddress, amountInWei]
        }
      };
    } catch (error) {
      console.error('SERVER ERROR: Failed to prepare allowance', error);

      return {
        success: false,
        message: `Failed to prepare the allowance transaction. Please try again later. Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
});

function getAgentAddressByEnergyProfile(energyProfile: TEnergyProfile) {
  switch (energyProfile) {
    case energyProfileConstant.consumer: {
      return env.NEXT_PUBLIC_CONSUMER_AGENT_WALLET as Address;
    }
    case energyProfileConstant.producer: {
      return env.NEXT_PUBLIC_PRODUCER_AGENT_WALLET as Address;
    }
    case energyProfileConstant.prosumer: {
      return env.NEXT_PUBLIC_PROSUMER_AGENT_WALLET as Address;
    }
    default: {
      throw new Error(`Unknown energy profile: ${energyProfile}`);
    }
  }
}
