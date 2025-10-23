/* eslint-disable @typescript-eslint/restrict-template-expressions */

import { tool } from 'ai';
import z from 'zod';

import { api } from '@/server/trpc';

export const saveEnergyDataTool = tool({
  description:
    'Save the user energy profile with all collected data based on their profile type. Extract the numerical values from the user message.',
  inputSchema: z.object({
    address: z.string().describe('The user address from the chat context'),
    energyProfile: z.enum(['consumer', 'producer', 'prosumer']).describe('The type of energy user'),
    production: z
      .number()
      .optional()
      .describe('Daily energy production in kWh (only for producer and prosumer)'),
    consumption: z
      .number()
      .optional()
      .describe('Daily energy consumption in kWh (only for consumer and prosumer)'),
    storageBatteryCapacity: z
      .number()
      .optional()
      .describe(
        'Storage battery capacity in kWh (only for producer and prosumer if they have one)'
      ),
    evBatteryCapacity: z
      .number()
      .optional()
      .describe('EV battery capacity in kWh (only for consumer and prosumer if they have one)')
  }),
  execute: async ({
    address,
    energyProfile,
    production,
    consumption,
    storageBatteryCapacity,
    evBatteryCapacity
  }) => {
    console.log('SERVER - Energy data:', {
      address,
      energyProfile,
      production,
      consumption,
      storageBatteryCapacity,
      evBatteryCapacity
    });

    const summaryParts = [
      `**Energy rofile:** ${energyProfile.charAt(0).toUpperCase() + energyProfile.slice(1)}`
    ];

    if (production !== undefined) {
      summaryParts.push(`**Daily Production:** ${production} kWh`);
    }

    if (consumption !== undefined) {
      summaryParts.push(`**Daily Consumption:** ${consumption} kWh`);
    }

    if (storageBatteryCapacity !== undefined) {
      summaryParts.push(`**Storage Battery Capacity:** ${storageBatteryCapacity} kWh`);
    }

    if (evBatteryCapacity !== undefined) {
      summaryParts.push(`**EV Battery Capacity:** ${evBatteryCapacity} kWh`);
    }

    try {
      await api.users.create({
        address,
        energyProfile,
        production,
        consumption,
        storageBatteryCapacity,
        evBatteryCapacity
      });
    } catch (error) {
      console.error('SERVER ERROR: Failed to create user', error);
      return {
        success: false,
        message: `Your energy profile has not been saved. Please try again later. Error: ${error}`
      };
    }

    return {
      success: true,
      message: `Great! Your energy profile has been saved successfully!\n\n**Summary:**\n${summaryParts.join('\n')}\n\nYou're all set! You can now start using AutonomousGrid to manage your energy.`,
      data: {
        energyProfile,
        production,
        consumption,
        storageBatteryCapacity,
        evBatteryCapacity
      }
    };
  }
});
