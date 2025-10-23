import { assistantName } from '~/src/lib/constants/shared';
import { tool } from 'ai';
import z from 'zod';

export const startWizardTool = tool({
  description: 'Start the energy data wizard and show the welcome message to the user',
  inputSchema: z.object({ address: z.string().describe("User's Ethereum wallet address") }),
  execute: async ({ address }) => {
    console.log('SERVER - Address', address);

    return {
      message: `
        Welcome in **AutonomousGrid**!

        I'm ${assistantName} ⚡, your personal assistan.

        I'll guide you through a brief wizard to set-up your account and understand your energy situation.

        Let's get started! Please tell me what type of user you are; select an option from the list above.
      `
    };
  }
});
