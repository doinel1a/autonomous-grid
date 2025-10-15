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
import { localhost } from 'viem/chains';
import z from 'zod';

import { config } from '../../../contract-deployments/local';
import { env } from '../../env';

const client = createPublicClient({
  chain: localhost,
  transport: http('http://127.0.0.1:8545')
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
    transferD1A: tool({
      description: 'Transfer D1A tokens from an address to another address',
      inputSchema: z.object({
        from: z.string().describe('The address to transfer tokens from'),
        to: z.string().describe('The address to transfer tokens to'),
        amount: z.string().describe('The amount of tokens to transfer')
      }),
      execute: async ({ from, to, amount }) => {
        let privateKey: Address | undefined;
        if (from === config.accounts.deployer.address) {
          privateKey = config.accounts.deployer.privateKey as Address;
        } else if (from === config.accounts.account1.address) {
          privateKey = config.accounts.account1.privateKey as Address;
        } else if (from === config.accounts.account2.address) {
          privateKey = config.accounts.account2.privateKey as Address;
        } else {
          return `Address ${from} is not available in the configuration`;
        }

        const account = privateKeyToAccount(privateKey);
        const wallet = createWalletClient({
          account,
          chain: {
            ...localhost,
            id: 31337
          },
          transport: http('http://127.0.0.1:8545')
        });

        const txHash = await wallet.writeContract({
          address: config.contractAddress as Address,
          abi: config.abi,
          functionName: 'transfer',
          args: [to as Address, parseEther(amount)]
        });

        await client.waitForTransactionReceipt({ hash: txHash });

        return `Successfully transferred ${amount} D1A from ${from} to ${to}. Transaction hash: ${txHash}`;
      }
    })
  },
  stopWhen: stepCountIs(10)
});

agent
  .generate({
    prompt: 'What is the Ethereum balance of 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266?'
  })
  .then((response) => {
    console.log(response.text);
  })
  .catch((error) => {
    console.error('Error:', error);
  });

// agent
//   .generate({
//     prompt: 'What is the D1A balance of 0x70997970c51812dc3a010c7d01b50e0d17dc79c8?'
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
//       'Transfer 50 D1A from 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 to 0x70997970c51812dc3a010c7d01b50e0d17dc79c8'
//   })
//   .then((response) => {
//     console.log(response.text);
//   })
//   .catch((error) => {
//     console.error('Error:', error);
//   });
