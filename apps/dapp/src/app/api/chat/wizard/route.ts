/* eslint-disable @typescript-eslint/restrict-template-expressions */

import type { UIMessage } from 'ai';

import { convertToModelMessages, stepCountIs, streamText, tool } from 'ai';
import { z } from 'zod';

import { assistantName, model, toolName } from '@/lib/constants/shared';
import { api } from '@/server/trpc';

type TBody = {
  messages: UIMessage[];
};

const WIZARD_SYSTEM_PROMPT = `
  You are an energy management wizard assistant helping users set up their energy profile.

  You have access to three tools:

  1. "startWizard": Use this tool when the user sends his Ethereum wallet address, an empty message or when starting a new conversation. This will show the welcome message and the energy profile selection.

  2. "getEnergyData": Use this tool as second step, after the user has selected their energy profile type (consumer, producer, or prosumer). This tool shows a form to collect the relevant data based on their profile:
     - For CONSUMER: consumption (required), and optionally if they have an EV with its battery capacity
     - For PRODUCER: production (required), and optionally if they have a storage battery with its capacity
     - For PROSUMER: both production and consumption (required), and optionally storage battery and/or EV with their capacities

  3. "saveEnergyData": Use this tool after the user has filled the form and submitted their energy data. Extract the information from their message and save their profile with the appropriate fields based on their energy profile type.

  Your conversation flow:
  1. If it's the first interaction or user sends empty message, use "startWizard" tool
  2. After user selects their energy profile type, use "getEnergyData" tool with the selected energyProfile
  3. Once the user submits the form with their data, use "saveEnergyData" tool to save their complete profile
  4. After saving, confirm success to the user with a summary

  Be friendly, clear, and patient. The form will handle data collection, so you just need to guide the flow.
`;

const startWizardTool = tool({
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

const getEnergyDataTool = tool({
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

const saveEnergyDataTool = tool({
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

export async function POST(request: Request) {
  const body = (await request.json()) as TBody;
  const { messages } = body;
  const result = streamText({
    model,
    system: WIZARD_SYSTEM_PROMPT,
    messages: convertToModelMessages(messages),
    tools: {
      [toolName.wizard.start]: startWizardTool,
      [toolName.wizard.getEnergyData]: getEnergyDataTool,
      [toolName.wizard.saveEnergyData]: saveEnergyDataTool
    },
    stopWhen: stepCountIs(5)
  });

  return result.toUIMessageStreamResponse();
}
