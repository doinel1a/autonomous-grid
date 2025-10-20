import path from 'node:path';

import { tool } from 'ai';
import z from 'zod';

import { appendToCSV, getActiveOffers, getMarketStateForTimestamp, getPriceHistory } from './csv';
import { BASE_DATA_PATH } from './shared';
import { TBid, TUserId } from './types';

export function getMarketPriceTool() {
  return tool({
    description: 'Get current VPP market price',
    inputSchema: z.object({
      timestamp: z.string().describe('Current timestamp in ISO format')
    }),
    execute: async ({ timestamp }) => {
      const marketState = getMarketStateForTimestamp(timestamp);
      if (!marketState) {
        return `No market data yet for timestamp ${timestamp}. Market is being initialized.`;
      }

      return `Current VPP price: €${marketState.vpp_price_eur_kwh.toFixed(3)}/kWh`;
    }
  });
}

export function getActiveOffersTool() {
  return tool({
    description: 'Get all active sell offers in the market',
    inputSchema: z.object({}),
    execute: async () => {
      const offers = getActiveOffers();
      if (offers.length === 0) {
        return 'No active sell offers in the market';
      }

      const totalSupply = offers.reduce((total, offer) => total + offer.kwh_available, 0);

      return JSON.stringify(
        {
          count: offers.length,
          total_supply_kwh: totalSupply.toFixed(2),
          offers: offers.map((offer) => ({
            seller: offer.seller_id,
            kwh: offer.kwh_available,
            price: offer.price_eur_kwh,
            timestamp: offer.timestamp
          }))
        },
        null,
        2
      );
    }
  });
}

export function getPriceHistoryTool() {
  return tool({
    description: 'Get price history for the last N time slots (15-min intervals)',
    inputSchema: z.object({
      timestamp: z.string().describe('Current timestamp in ISO format'),
      lookback: z.number().describe('Number of 15-min slots to look back (e.g., 8 = 2 hours)')
    }),
    execute: async ({ timestamp, lookback }) => {
      const prices = getPriceHistory(timestamp, lookback);
      if (prices.length === 0) {
        return 'No price history available yet.';
      }

      const average = prices.reduce((accumulator, value) => accumulator + value, 0) / prices.length;
      const min = Math.min(...prices);
      const max = Math.max(...prices);

      return JSON.stringify(
        {
          prices,
          average: average.toFixed(3),
          min: min.toFixed(3),
          max: max.toFixed(3),
          count: prices.length
        },
        null,
        2
      );
    }
  });
}

export function createBidTool(userId: TUserId) {
  return tool({
    description: 'Create a buy request when in energy deficit',
    inputSchema: z.object({
      timestamp: z.string().describe('Current timestamp'),
      kwh: z.number().describe('Amount of energy needed in kWh'),
      maxPrice: z.number().describe('Maximum price willing to pay per kWh in EUR')
    }),
    execute: async ({ timestamp, kwh, maxPrice }) => {
      const bid: TBid = {
        timestamp,
        buyer_id: userId,
        kwh_needed: kwh,
        max_price_eur_kwh: maxPrice,
        status: 'active'
      };

      const bidsPath = path.join(BASE_DATA_PATH, 'bids.csv');
      appendToCSV(bidsPath, bid);

      return `Created buy request: ${kwh.toFixed(2)} kWh @ max €${maxPrice.toFixed(3)}/kWh`;
    }
  });
}
