import path from 'node:path';

import { openai } from '@ai-sdk/openai';

import { appendToCSV, getActiveBids, getActiveOffers } from './csv';
import { TBid, TOffer } from './types';

export const BASE_DATA_PATH = path.join(process.cwd(), 'src', 'agents', 'test-dummy-data', 'data');
export const model = openai('gpt-4o');

export const batteryState: { [userId: string]: number } = {
  maria: 8.5, // producer
  lucia: 6.5 // prosumer
};

export function getBatteryLevel(userId: string): number {
  return batteryState[userId];
}

export const evChargingState: { [userId: string]: number } = {
  pietro: 0 // Starts at 0 kWh, needs 20 kWh total
};

export function getEVChargingLevel(userId: string): number {
  return evChargingState[userId];
}

export function resetEVCharging(userId: string) {
  evChargingState[userId] = 0;
}
export function getMarketSummary(timestamp: string) {
  const offers = getActiveOffers();
  const bids = getActiveBids();

  const totalSupply = offers.reduce((sum, offer) => sum + offer.kwh_available, 0);
  const totalDemand = bids.reduce((sum, bid) => sum + bid.kwh_needed, 0);
  const balance = totalSupply - totalDemand;

  return {
    timestamp,
    offers_count: offers.length,
    bids_count: bids.length,
    total_supply_kwh: totalSupply,
    total_demand_kwh: totalDemand,
    balance_kwh: balance
  };
}

export function createOffer(offer: TOffer) {
  const offersPath = path.join(BASE_DATA_PATH, 'offers.csv');
  appendToCSV(offersPath, offer);
}

export function createBid(bid: TBid) {
  const bidsPath = path.join(BASE_DATA_PATH, 'bids.csv');
  appendToCSV(bidsPath, bid);
}
