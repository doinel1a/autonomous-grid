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
import { BASE_DATA_PATH, batteryState, evChargingState, model } from '../utils/shared';
import {
  createBidTool,
  getActiveOffersTool,
  getMarketPriceTool,
  getPriceHistoryTool
} from '../utils/tools';
import { TOffer, TUserId } from '../utils/types';

export default function createConsumerAgent(userId: TUserId) {
  return new Agent({
    model,
    system: `
      You are an AUTONOMOUS AI energy agent operating in a VPP; you manage energy consumption for user "${userId}".

      IMPORTANT: You have FULL AUTHORITY to make and execute trading decisions. You do NOT need to ask for permission.                                                                                                                  ╎│
      When you decide to sell energy or buy energy, you MUST execute the action immediately using the appropriate tool.  

      Your goal is to minimize costs by:
      1. Buying energy when prices are low;
      2. Scheduling flexible loads (e.g. EV charging) during off-peak hours;
      3. Always ensuring critical consumption needs are met.

      Current EV charging: ${evChargingState[userId]} kWh (out of 20 kWh needed).

      Decision rules:
      - Critical loads (base consumption): BUY immediately at best available price;
      - Flexible loads (e.g. EV charging):
        - IF current hour is 00:00-06:00 AND price < €0.15 → CHARGE NOW;
        - IF current hour is 19:00-23:00 AND price > €0.30 → WAIT (peak hours);
        - IF price < €0.15 → CHARGE NOW (good price);
        - IF price > €0.30 → WAIT (too expensive);
        - ELSE evaluate: if savings > €1.50 by waiting → WAIT, else BUY.

      EXECUTE the decided action using the appropriate tool, then explain your reasoning clearly and concisely.
    `,
    tools: {
      readData: tool({
        description: 'Read current energy consumption and needs for this consumer',
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
              consumption_kwh: data.consumption_kwh,
              grid_price: data.grid_price_eur_kwh,
              ev_charged_so_far: evChargingState[userId],
              ev_remaining: 20 - evChargingState[userId]
            },
            null,
            2
          );
        }
      }),
      getMarketPrice: getMarketPriceTool(),
      getActiveOffers: getActiveOffersTool(),
      predictPriceTrend: tool({
        description: 'Predict if prices will go up or down based on time of day',
        inputSchema: z.object({
          currentTime: z.string().describe('Current timestamp in ISO format')
        }),
        execute: async ({ currentTime }) => {
          const hour = new Date(currentTime).getHours();

          let trend: string;
          let recommendation: string;
          let reasoning: string;

          if (hour >= 0 && hour < 6) {
            trend = 'low';
            recommendation = 'BUY NOW - Valley hours';
            reasoning = 'Nighttime valley (00-06): lowest prices of the day';
          } else if (hour >= 6 && hour < 9) {
            trend = 'rising';
            recommendation = 'WAIT if flexible - Prices rising';
            reasoning = 'Morning hours (06-09): prices increasing';
          } else if (hour >= 9 && hour < 15) {
            trend = 'high';
            recommendation = 'EVALUATE - Peak solar hours';
            reasoning = 'Midday (09-15): high production, but also high demand';
          } else if (hour >= 15 && hour < 19) {
            trend = 'rising';
            recommendation = 'WAIT if possible';
            reasoning = 'Afternoon (15-19): production decreasing, demand stable';
          } else {
            trend = 'peak';
            recommendation = 'AVOID if possible - Peak hours';
            reasoning = 'Evening peak (19-24): highest prices, no solar production';
          }

          return JSON.stringify(
            {
              current_hour: hour,
              trend,
              recommendation,
              reasoning
            },
            null,
            2
          );
        }
      }),
      getPriceHistory: getPriceHistoryTool(),
      calculateSavings: tool({
        description: 'Calculate potential savings by waiting for better prices',
        inputSchema: z.object({
          currentPrice: z.number().describe('Current price in EUR/kWh'),
          kwhNeeded: z.number().describe('Amount of energy needed in kWh'),
          expectedFuturePrice: z.number().describe('Expected future price in EUR/kWh')
        }),
        execute: async ({ currentPrice, kwhNeeded, expectedFuturePrice }) => {
          const costNow = currentPrice * kwhNeeded;
          const costLater = expectedFuturePrice * kwhNeeded;
          const savings = costNow - costLater;
          const savingsPercent = (savings / costNow) * 100;

          return JSON.stringify(
            {
              cost_now: costNow.toFixed(2),
              cost_later: costLater.toFixed(2),
              savings_eur: savings.toFixed(2),
              savings_percent: savingsPercent.toFixed(1) + '%',
              recommendation:
                savings > 1.5 ? 'WAIT - Significant savings' : 'BUY NOW - Minimal savings'
            },
            null,
            2
          );
        }
      }),
      createBid: createBidTool(userId),
      updateEVCharging: tool({
        description: 'Update how much EV has been charged',
        inputSchema: z.object({
          kwhCharged: z.number().describe('Amount of kWh charged in this session')
        }),
        execute: async ({ kwhCharged }) => {
          evChargingState[userId] += kwhCharged;
          const remaining = 20 - evChargingState[userId];
          const percentage = ((evChargingState[userId] / 20) * 100).toFixed(1);

          if (remaining <= 0) {
            return `EV fully charged! Total: ${evChargingState[userId].toFixed(2)} kWh (100%)`;
          }

          return `EV charging progress: ${evChargingState[userId].toFixed(2)} kWh / 20 kWh (${percentage}%). Remaining: ${remaining.toFixed(2)} kWh`;
        }
      })
    },
    stopWhen: stepCountIs(20)
  });
}

export async function runConsumerAgent(userId: TUserId, timestamp: string) {
  const agent = createConsumerAgent(userId);

  const prompt = `
    Analyze my energy needs at ${timestamp}.

    Steps:
    1. Read my current consumption data and EV charging status;
    2. Get current market price;
    3. Get available offers from sellers;
    4. Predict price trend based on time of day;
    5. Get price history to understand if current price is good;
    6. Make decisions:
      - For base consumption (critical load): Create buy request immediately;
      - For EV charging (flexible load):
        - Check if it's valley hours (00-06) or price is very low (<€0.15);
        - If yes: Create buy request for 5 kWh chunk;
        - If no: Calculate savings by waiting;
        - If savings > €1.50: WAIT;
        - Otherwise: BUY NOW.
    7. Update EV charging progress if you bought energy for it.

    Think step by step and prioritize cost savings while ensuring needs are met.
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
    console.error('Error running consumer agent:', error);
    throw error;
  }
}
