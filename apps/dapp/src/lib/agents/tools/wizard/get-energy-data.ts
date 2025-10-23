import { tool } from 'ai';
import z from 'zod';

export const getEnergyDataTool = tool({
  description: 'Show the energy data collection form based on the user energy profile type',
  inputSchema: z.object({
    energyProfile: z.enum(['consumer', 'producer', 'prosumer']).describe('The type of energy user')
  }),
  execute: async ({ energyProfile }) => {
    console.log('SERVER - energyProfile:', energyProfile);

    const formInstructions = {
      consumer:
        'Please provide your daily energy consumption and let me know if you have an electric vehicle.',
      producer:
        'Please provide your daily energy production and let me know if you have a storage battery.',
      prosumer:
        'Please provide your daily energy production and consumption, and let me know if you have a storage battery and/or an electric vehicle.'
    };

    return {
      message: `Perfect! ${formInstructions[energyProfile]} Fill in the form below to continue.`
    };
  }
});
