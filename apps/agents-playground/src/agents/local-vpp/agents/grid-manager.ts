import { Experimental_Agent as Agent, stepCountIs, tool } from 'ai';
import z from 'zod';

import {
  createTransaction,
  getActiveBids,
  getActiveOffers,
  getAllEnergyDataForTimestamp,
  saveMarketState,
  updateBidStatus,
  updateOfferStatus
} from '../utils/csv';
import { model } from '../utils/shared';
import { getActiveOffersTool } from '../utils/tools';
import { TMarketState, TTransaction } from '../utils/types';

export function createGridManagerAgent() {
  return new Agent({
    model,
    system: `
      You are the Grid Manager AI for the AutonomousGrid Virtual Power Plant.

      IMPORTANT: You have FULL AUTHORITY to make and execute trading decisions. You do NOT need to ask for permission.                                                                                                                  ╎│
      When you decide to sell energy or buy energy, you MUST execute the action immediately using the appropriate tool.     

      Your responsibilities:
      1. Aggregate all supply (offers) and demand (bids) in the market;
      2. Calculate dynamic VPP pricing based on supply/demand balance;
      3. Match compatible offers with bids to create transactions;
      4. Update market state for all participants;
      5. Ensure market stability and fair pricing.

      Pricing Rules:
      - Base price = grid_price * 0.85 (15% discount vs national grid);
      - If balance < -5 kWh (critical deficit): price = base * 1.30;
      - If balance < 0 (deficit): price = base * 1.15;
      - If balance > 10 kWh (surplus): price = base * 0.85;
      - Otherwise (balanced): price = base.

      Matching Rules:
      - Match offers (lowest price first) with bids (highest price first);
      - Only match if bid.max_price >= offer.price;
      - Create transaction at offer price (seller sets price);
      - Update both offer and bid status to "matched";
      - Handle partial matches if needed.

      EXECUTE the decided action using the appropriate tool, then explain your analysis, the transactions that have happened and report the state of the market; be clear and concise.
    `,
    tools: {
      getActiveOffers: getActiveOffersTool(),
      getActiveBids: tool({
        description: 'Get all active buy requests in the market',
        inputSchema: z.object({}),
        execute: async () => {
          const bids = getActiveBids();
          if (bids.length === 0) {
            return 'No active bids in the market.';
          }

          const totalDemand = bids.reduce((sum, bid) => sum + bid.kwh_needed, 0);

          return JSON.stringify(
            {
              count: bids.length,
              total_demand_kwh: totalDemand.toFixed(2),
              bids: bids.map((bid) => ({
                buyer: bid.buyer_id,
                kwh: bid.kwh_needed,
                max_price: bid.max_price_eur_kwh,
                timestamp: bid.timestamp
              }))
            },
            null,
            2
          );
        }
      }),
      calculateBalance: tool({
        description: 'Calculate the market balance (total supply - total demand)',
        inputSchema: z.object({
          totalSupply: z.number().describe('Total supply in kWh'),
          totalDemand: z.number().describe('Total demand in kWh')
        }),
        execute: async ({ totalSupply, totalDemand }) => {
          const balance = totalSupply - totalDemand;

          let status = '';
          if (balance < -5) {
            status = 'CRITICAL DEFICIT - Need to increase supply or reduce demand';
          } else if (balance < 0) {
            status = 'DEFICIT - Demand exceeds supply';
          } else if (balance > 10) {
            status = 'SURPLUS - Supply exceeds demand significantly';
          } else {
            status = 'BALANCED - Supply and demand are matched';
          }

          return JSON.stringify(
            {
              total_supply_kwh: totalSupply.toFixed(2),
              total_demand_kwh: totalDemand.toFixed(2),
              balance_kwh: balance.toFixed(2),
              status
            },
            null,
            2
          );
        }
      }),
      calculateDynamicPrice: tool({
        description: 'Calculate VPP price based on supply/demand balance and grid price',
        inputSchema: z.object({
          balance: z.number().describe('Market balance in kWh (supply - demand)'),
          gridPrice: z.number().describe('Current national grid price in EUR/kWh')
        }),
        execute: async ({ balance, gridPrice }) => {
          const basePrice = gridPrice * 0.85; // 15% discount on vpp vs grid

          let vppPrice: number;
          let multiplier: number;
          let reason: string;

          if (balance < -5) {
            multiplier = 1.3;
            vppPrice = basePrice * multiplier;
            reason = 'CRITICAL DEFICIT: applying +30% premium';
          } else if (balance < 0) {
            multiplier = 1.15;
            vppPrice = basePrice * multiplier;
            reason = 'DEFICIT: applying +15% premium';
          } else if (balance > 10) {
            multiplier = 0.85;
            vppPrice = basePrice * multiplier;
            reason = 'SURPLUS: applying -15% discount';
          } else {
            multiplier = 1.0;
            vppPrice = basePrice;
            reason = 'BALANCED market: base price';
          }

          return JSON.stringify(
            {
              grid_price: gridPrice.toFixed(3),
              base_price: basePrice.toFixed(3),
              vpp_price: vppPrice.toFixed(3),
              multiplier: multiplier.toFixed(2),
              reason,
              discount_vs_grid: `${((1 - vppPrice / gridPrice) * 100).toFixed(1)}%`
            },
            null,
            2
          );
        }
      }),
      matchOffersToBids: tool({
        description: 'Match compatible offers with bids and create transactions',
        inputSchema: z.object({
          timestamp: z.string().describe('Current timestamp for transactions in ISO format')
        }),
        execute: async ({ timestamp }) => {
          const offers = getActiveOffers();
          const bids = getActiveBids();
          if (offers.length === 0 || bids.length === 0) {
            return (
              'No matching possible: ' +
              (offers.length === 0 ? 'no offers' : '') +
              (bids.length === 0 ? 'no bids' : '')
            );
          }

          const sortedOffers = [...offers].sort((a, b) => a.price_eur_kwh - b.price_eur_kwh);
          const sortedBids = [...bids].sort((a, b) => b.max_price_eur_kwh - a.max_price_eur_kwh);

          const matches: any[] = [];
          let totalKwhMatched = 0;
          let totalValueMatched = 0;

          for (const bid of sortedBids) {
            let remainingNeed = bid.kwh_needed;

            for (const offer of sortedOffers) {
              // Check if bid can afford this offer
              if (bid.max_price_eur_kwh < offer.price_eur_kwh) {
                continue; // Bid can't afford this offer
              }

              if (offer.kwh_available <= 0) {
                continue; // Offer fully consumed
              }

              // Calculate match quantity
              const matchKwh = Math.min(remainingNeed, offer.kwh_available);
              if (matchKwh > 0) {
                const transaction: TTransaction = {
                  timestamp,
                  seller_id: offer.seller_id,
                  buyer_id: bid.buyer_id,
                  kwh: matchKwh,
                  price_eur_kwh: offer.price_eur_kwh, // Seller sets price
                  total_eur: matchKwh * offer.price_eur_kwh,
                  tx_type: 'p2p'
                };

                createTransaction(transaction);

                matches.push({
                  seller: offer.seller_id,
                  buyer: bid.buyer_id,
                  kwh: matchKwh.toFixed(2),
                  price: offer.price_eur_kwh.toFixed(3),
                  total: transaction.total_eur.toFixed(2)
                });

                totalKwhMatched += matchKwh;
                totalValueMatched += transaction.total_eur;

                // Update remaining quantities
                offer.kwh_available -= matchKwh;
                remainingNeed -= matchKwh;

                // Update statuses
                if (offer.kwh_available <= 0.001) {
                  // Fully consumed
                  updateOfferStatus(offer.timestamp, offer.seller_id, 'matched');
                }

                if (remainingNeed <= 0.001) {
                  // Bid fully satisfied
                  updateBidStatus(bid.timestamp, bid.buyer_id, 'matched');
                  break; // Move to next bid
                }
              }
            }
          }

          if (matches.length === 0) {
            return 'No compatible matches found. Price mismatch: bids are below offer prices.';
          }

          return JSON.stringify(
            {
              matches_count: matches.length,
              total_kwh_matched: totalKwhMatched.toFixed(2),
              total_value_eur: totalValueMatched.toFixed(2),
              average_price: (totalValueMatched / totalKwhMatched).toFixed(3),
              matches
            },
            null,
            2
          );
        }
      }),
      getGridPrice: tool({
        description: 'Get the average national grid price for current timestamp',
        inputSchema: z.object({
          timestamp: z.string().describe('Current timestamp')
        }),
        execute: async ({ timestamp }) => {
          const energyData = getAllEnergyDataForTimestamp(timestamp);
          if (energyData.length === 0) {
            return 'No energy data found for this timestamp';
          }

          const averageGridPrice =
            energyData.reduce((sum, data) => sum + data.grid_price_eur_kwh, 0) / energyData.length;

          return `Average grid price: €${averageGridPrice.toFixed(3)}/kWh`;
        }
      }),
      saveMarketState: tool({
        description: 'Save the current market state to CSV',
        inputSchema: z.object({
          timestamp: z.string().describe('Current timestamp'),
          totalSupply: z.number().describe('Total supply in kWh'),
          totalDemand: z.number().describe('Total demand in kWh'),
          vppPrice: z.number().describe('VPP price in EUR/kWh'),
          balance: z.number().describe('Balance in kWh')
        }),
        execute: async ({ timestamp, totalSupply, totalDemand, vppPrice, balance }) => {
          const marketState: TMarketState = {
            timestamp,
            total_supply_kwh: totalSupply,
            total_demand_kwh: totalDemand,
            vpp_price_eur_kwh: vppPrice,
            balance_kwh: balance
          };

          saveMarketState(marketState);

          return `Market state saved: Supply ${totalSupply.toFixed(2)} kWh, Demand ${totalDemand.toFixed(2)} kWh, Price €${vppPrice.toFixed(3)}/kWh, Balance ${balance.toFixed(2)} kWh`;
        }
      })
    },
    stopWhen: stepCountIs(20)
  });
}

export async function runGridManagerAgent(timestamp: string) {
  const agent = createGridManagerAgent();
  const prompt = `
    Analyze and manage the VPP market at ${timestamp}.

    Your tasks:
    1. Get all active offers (sell orders) in the market;
    2. Get all active bids (buy requests) in the market;
    3. Calculate total supply and demand;
    4. Calculate market balance (supply - demand);
    5. Get the current national grid price;
    6. Calculate the dynamic VPP price based on balance;
    7. Match compatible offers with bids to create transactions;
    8. Save the market state.

    Execute these steps systematically and report:
    - Current market status (supply, demand, balance);
    - VPP price and reasoning;
    - Number of matches created;
    - Total energy traded.

    Use all available tools to complete this analysis.
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
    console.error('Error running grid manager agent:', error);
    throw error;
  }
}
