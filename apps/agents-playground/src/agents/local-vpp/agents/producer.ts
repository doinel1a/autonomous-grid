import 'dotenv/config';

import path from 'node:path';

import { Experimental_Agent as Agent, stepCountIs, tool } from 'ai';
import z from 'zod';

import {
  appendToCSV,
  getDataForTimestamp,
  getMarketStateForTimestamp,
  getPriceHistory
} from '../utils/csv';
import { BASE_DATA_PATH, batteryState, model } from '../utils/shared';
import { createBidTool, getMarketPriceTool, getPriceHistoryTool } from '../utils/tools';
import { TBid, TOffer, TUserId } from '../utils/types';

export function createProducerAgent(userId: TUserId) {
  return new Agent({
    model,
    system: `
      You are an AUTONOMOUS AI energy agent operating in a VPP; you manage solar production for user "${userId}".

      IMPORTANT: You have FULL AUTHORITY to make and execute trading decisions. You do NOT need to ask for permission.                                                                                                                  ╎│
      When you decide to sell energy or buy energy, you MUST execute the action immediately using the appropriate tool.     

      Your goal is to maximize profit by:
      1. Selling excess energy when prices are high;
      2. Storing energy in battery when prices are low;
      3. Making smart decisions based on market conditions.

      Current battery level: ${batteryState[userId]} kWh.

      Decision rules (EXECUTE THESE AUTOMATICALLY):  
      - Calculate excess: production - consumption;
      - If excess > 0:
        - Check current VPP price vs average of last 2 hours (8 slots);
        - If price > average * 1.15 → SELL immediately;
        - If battery < 80% capacity → CHARGE battery first;
        - Otherwise → SELL at price = average * 1.05.
      - If excess < 0 (deficit):
        - Use battery if available;
        - Otherwise create buy request.
        
      EXECUTE the decided action using the appropriate tool, then explain your reasoning clearly and concisely.
    `,
    tools: {
      readData: tool({
        description:
          'Read current energy production, consumption, and battery status for this producer.',
        inputSchema: z.object({
          timestamp: z.string().describe('Current timestamp in ISO format')
        }),
        execute: async ({ timestamp }) => {
          const data = getDataForTimestamp(timestamp, userId);
          if (!data) {
            return `No data found for ${userId} at ${timestamp}`;
          }

          return JSON.stringify(
            {
              timestamp: data.timestamp,
              production_kwh: data.solar_production_kwh,
              consumption_kwh: data.consumption_kwh,
              battery_capacity: data.battery_capacity_kwh,
              current_battery_level: batteryState[userId],
              grid_price: data.grid_price_eur_kwh
            },
            null,
            2
          );
        }
      }),
      calculateExcess: tool({
        description: 'Calculate energy excess or deficit (production - consumption)',
        inputSchema: z.object({
          production: z.number().describe('Solar production in kWh'),
          consumption: z.number().describe('Current consumption in kWh')
        }),
        execute: async ({ production, consumption }) => {
          const excess = production - consumption;
          return `Excess energy: ${excess.toFixed(2)} kWh (${excess > 0 ? 'SURPLUS' : 'DEFICIT'})`;
        }
      }),
      getMarketPrice: getMarketPriceTool(),
      getPriceHistory: getPriceHistoryTool(),
      createSellOffer: tool({
        description: 'Create a sell offer on the VPP market',
        inputSchema: z.object({
          timestamp: z.string().describe('Current timestamp in ISO format'),
          kwh: z.number().describe('Amount of energy to sell in kWh'),
          pricePerKwh: z.number().describe('Price per kWh in EUR')
        }),
        execute: async ({ timestamp, kwh, pricePerKwh }) => {
          const offer: TOffer = {
            timestamp,
            seller_id: userId,
            kwh_available: kwh,
            price_eur_kwh: pricePerKwh,
            status: 'active'
          };

          const offersPath = path.join(BASE_DATA_PATH, 'offers.csv');
          appendToCSV(offersPath, offer);

          return `Created sell offer: ${kwh.toFixed(2)} kWh @ €${pricePerKwh.toFixed(3)}/kWh (Total: €${(kwh * pricePerKwh).toFixed(2)})`;
        }
      }),
      chargeBattery: tool({
        description: 'Store excess energy in battery',
        inputSchema: z.object({
          kwhToCharge: z.number().describe('Amount of energy to store in kWh'),
          batteryCapacity: z.number().describe('Maximum battery capacity in kWh')
        }),
        execute: async ({ kwhToCharge, batteryCapacity }) => {
          const currentLevel = batteryState[userId];
          const availableSpace = batteryCapacity - currentLevel;
          const actualCharge = Math.min(kwhToCharge, availableSpace);

          batteryState[userId] = currentLevel + actualCharge;

          const percentage = ((batteryState[userId] / batteryCapacity) * 100).toFixed(1);

          return `Battery charged: +${actualCharge.toFixed(2)} kWh. New level: ${batteryState[userId].toFixed(2)} kWh (${percentage}% of ${batteryCapacity} kWh capacity)`;
        }
      }),
      dischargeBattery: tool({
        description: 'Use stored energy from battery to cover consumption deficit',
        inputSchema: z.object({
          kwhNeeded: z.number().describe('Amount of energy needed in kWh')
        }),
        execute: async ({ kwhNeeded }) => {
          const currentLevel = batteryState[userId];
          const actualDischarge = Math.min(kwhNeeded, currentLevel);

          batteryState[userId] = currentLevel - actualDischarge;

          if (actualDischarge < kwhNeeded) {
            const stillNeeded = kwhNeeded - actualDischarge;
            return `Battery discharged: -${actualDischarge.toFixed(2)} kWh. New level: ${batteryState[userId].toFixed(2)} kWh. Still need ${stillNeeded.toFixed(2)} kWh from market.`;
          }

          return `Battery discharged: -${actualDischarge.toFixed(2)} kWh. New level: ${batteryState[userId].toFixed(2)} kWh. Deficit covered.`;
        }
      }),
      createBid: createBidTool(userId)
    },
    stopWhen: stepCountIs(20)
  });
}

export async function runProducerAgent(userId: TUserId, timestamp: string) {
  const agent = createProducerAgent(userId);
  const prompt = `
    Analyze my energy situation at ${timestamp}. 
  
    Steps:
    1. Read my current production, consumption, and battery status;
    2. Calculate if I have excess energy or deficit;
    3. Get current market price;
    4. Get price history for last 2 hours (8 slots);
    5. Make a decision:
      - If I have excess energy and price is good (>15% above average), create a sell offer;
      - If I have excess energy and battery is not full (<80%), charge battery;
      - If I have excess energy but price is not great, sell at average price * 1.05;
      - If I have a deficit, use battery or create buy request;
    6. Explain your decision clearly.

    Think step by step and use the tools available.
  `;

  try {
    const result = await agent.generate({
      prompt
    });

    return {
      text: result.text,
      steps: result.steps,
      usage: result.usage
    };
  } catch (error) {
    console.error('Error running producer agent:', error);
    throw error;
  }
}
