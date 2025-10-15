import 'dotenv/config';

import { openai } from '@ai-sdk/openai';
import { Experimental_Agent as Agent, stepCountIs, tool } from 'ai';
import {
  Address,
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import z from 'zod';

import { config } from '../../../contract-deployments/sepolia';
import { env } from '../../env';

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL)
});

const agent = new Agent({
  model: openai('gpt-4o'),
  tools: {
    getETHBalance: tool({
      description: 'Get Ethereum balance of a given address',
      inputSchema: z.object({
        address: z.string().describe('The address to check the balance of')
      }),
      execute: async ({ address }) => {
        const balance = await client.getBalance({ address: address as Address });
        const formattedBalance = formatEther(balance);
        return `The balance of ${address} is ${formattedBalance} ETH`;
      }
    }),
    getD1ABalance: tool({
      description: 'Get D1A balance of a given address',
      inputSchema: z.object({
        address: z.string().describe('The address to check the balance of')
      }),
      execute: async ({ address }) => {
        const balance = await client.readContract({
          address: config.contractAddress,
          abi: config.abi,
          functionName: 'balanceOf',
          args: [address as Address]
        });

        const formattedBalance = formatEther(balance);
        return `The balance of ${address} is ${formattedBalance} D1A`;
      }
    }),
    approveAllowanceOnBehalfOfDeployer: tool({
      description: 'Approve a spender address to spend D1A tokens on behalf of the deployer',
      inputSchema: z.object({
        spender: z.string().describe('The address that will be allowed to spend tokens'),
        amount: z.string().describe('The amount of tokens to approve (in D1A, not wei)')
      }),
      execute: async ({ spender, amount }) => {
        try {
          const deployerAccount = privateKeyToAccount(process.env.WALLET_1_PRIVATE_KEY as Address);
          const deployerWallet = createWalletClient({
            account: deployerAccount,
            chain: sepolia,
            transport: http(process.env.SEPOLIA_RPC_URL)
          });

          const txHash = await deployerWallet.writeContract({
            address: config.contractAddress as Address,
            abi: config.abi,
            functionName: 'approve',
            args: [spender as Address, parseEther(amount)]
          });

          await client.waitForTransactionReceipt({ hash: txHash });

          return `Successfully approved ${amount} D1A for spender ${spender}. Transaction hash: ${txHash}`;
        } catch (error) {
          console.error('Error', error);
          return error;
        }
      }
    }),
    increaseAllowanceOnBehalfOfDeployer: tool({
      description:
        'Increase the allowance of a spender address to spend D1A tokens on behalf of the deployer',
      inputSchema: z.object({
        spender: z.string().describe('The address that will be allowed to spend tokens'),
        amount: z
          .string()
          .describe('The amount of tokens to increase the allowance by (in D1A, not wei)')
      }),
      execute: async ({ spender, amount }) => {
        try {
          const deployerAccount = privateKeyToAccount(process.env.WALLET_1_PRIVATE_KEY as Address);
          const deployerWallet = createWalletClient({
            account: deployerAccount,
            chain: sepolia,
            transport: http(process.env.SEPOLIA_RPC_URL)
          });

          const txHash = await deployerWallet.writeContract({
            address: config.contractAddress as Address,
            abi: config.abi,
            functionName: 'increaseAllowance',
            args: [spender as Address, parseEther(amount)]
          });

          await client.waitForTransactionReceipt({ hash: txHash });

          return `Successfully approved ${amount} D1A for spender ${spender}. Transaction hash: ${txHash}`;
        } catch (error) {
          console.error('Error', error);
          return error;
        }
      }
    }),
    getD1AAllowance: tool({
      description: 'Check how many D1A tokens a spender is allowed to spend on behalf of an owner',
      inputSchema: z.object({
        owner: z.string().describe('The address that owns the tokens'),
        spender: z.string().describe('The address that is allowed to spend tokens')
      }),
      execute: async ({ owner, spender }) => {
        try {
          const allowance = await client.readContract({
            address: config.contractAddress as Address,
            abi: config.abi,
            functionName: 'allowance',
            args: [owner as Address, spender as Address]
          });

          const formattedAllowance = formatEther(allowance);
          return `The allowance for spender ${spender} from owner ${owner} is ${formattedAllowance} D1A`;
        } catch (error) {
          console.error('Error', error);
          return error;
        }
      }
    })
  },
  stopWhen: stepCountIs(10)
});

// agent
//   .generate({
//     prompt: 'What is the Ethereum balance of 0xff99d15BE06e8a3752eA9ff9FF907d3Ba5976b92?'
//   })
//   .then((response) => {
//     console.log(response.text);
//   })
//   .catch((error) => {
//     console.error('Error:', error);
//   });

// agent
//   .generate({
//     prompt: 'Approve 100 D1A for spender 0xd7b4967Edbc170774345b4a84F2E2c2CD3a3f102'
//   })
//   .then((response) => {
//     console.log(response.text);
//   })
//   .catch((error) => {
//     console.error('Error:', error);
//   });

// agent
//   .generate({
//     prompt:
//       'Check the allowance for spender 0xd7b4967Edbc170774345b4a84F2E2c2CD3a3f102 from owner 0xff99d15BE06e8a3752eA9ff9FF907d3Ba5976b92'
//   })
//   .then((response) => {
//     console.log(response.text);
//   })
//   .catch((error) => {
//     console.error('Error:', error);
//   });

// agent
//   .generate({
//     prompt:
//       "Check if 0xd7b4967Edbc170774345b4a84F2E2c2CD3a3f102 has already an allowance approved (allowance > 0); if he doesn', approve him 69 D1A to spend; otherwise increase his allowance by 100. After approval, check the new allowance for the spender from the owner 0xff99d15BE06e8a3752eA9ff9FF907d3Ba5976b92."
//   })
//   .then((response) => {=
//     console.log(response.text);
//   })
//   .catch((error) => {
//     console.error('Error:', error);
//   });

agent
  .generate({
    prompt:
      "Check if 0x87D54a91F36027B06EC11f70Be572eb71597f202 has already an allowance approved (allowance > 0); if he doesn', approve him 69 D1A to spend; otherwise increase his allowance by 100. After approval, check the new allowance for the spender from the owner 0xff99d15BE06e8a3752eA9ff9FF907d3Ba5976b92."
  })
  .then((response) => {
    console.log(response.text);
  })
  .catch((error) => {
    console.error('Error:', error);
  });
