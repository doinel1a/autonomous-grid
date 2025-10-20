import * as fs from 'node:fs';
import path from 'node:path';

import Papa from 'papaparse';

import { BASE_DATA_PATH } from './shared';
import { TBid, TEnergyData, TMarketState, TOffer, TTransaction } from './types';

function readCSV<T>(filePath: string): T[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const parsed = Papa.parse(fileContent, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });

  return parsed.data as T[];
}

export function appendToCSV(filePath: string, data: any) {
  const fileExists = fs.existsSync(filePath);
  if (!fileExists || fs.readFileSync(filePath, 'utf-8').trim() === '') {
    const headers = Object.keys(data).join(',') + '\n';
    fs.writeFileSync(filePath, headers);
  }

  const values = Object.values(data).join(',') + '\n';
  fs.appendFileSync(filePath, values);
}

export function writeCSV<T>(filePath: string, data: T[]) {
  if (data.length === 0) {
    return;
  }

  const headers = Object.keys(data[0] as any).join(',') + '\n';
  const rows = data.map((row) => Object.values(row as any).join(',')).join('\n');
  fs.writeFileSync(filePath, headers + rows + '\n');
}

export function getDataForTimestamp(timestamp: string, userId: string): TEnergyData | null {
  const dataPath = path.join(BASE_DATA_PATH, 'energy.csv');
  const allData = readCSV<TEnergyData>(dataPath);
  const record = allData.find((row) => row.timestamp === timestamp && row.user_id === userId);
  return record || null;
}

export function getMarketStateForTimestamp(timestamp: string): TMarketState | null {
  const marketPath = path.join(BASE_DATA_PATH, 'market-state.csv');
  if (!fs.existsSync(marketPath)) {
    return null;
  }

  const allData = readCSV<TMarketState>(marketPath);
  const record = allData.find((row) => row.timestamp === timestamp);
  return record || null;
}

export function getPriceHistory(timestamp: string, lookback: number): number[] {
  const marketPath = path.join(BASE_DATA_PATH, 'market-state.csv');
  if (!fs.existsSync(marketPath)) {
    return [];
  }

  const allData = readCSV<TMarketState>(marketPath);
  const currentIndex = allData.findIndex((row) => row.timestamp === timestamp);
  if (currentIndex === -1) {
    return [];
  }

  const startIndex = Math.max(0, currentIndex - lookback);
  const priceHistory = allData.slice(startIndex, currentIndex).map((row) => row.vpp_price_eur_kwh);
  return priceHistory;
}

export function getActiveOffers(): TOffer[] {
  const offersPath = path.join(BASE_DATA_PATH, 'offers.csv');
  const allOffers = readCSV<TOffer>(offersPath);
  return allOffers.filter((offer) => offer.status === 'active');
}

export function getActiveBids(): TBid[] {
  const bidsPath = path.join(BASE_DATA_PATH, 'bids.csv');
  const allBids = readCSV<TBid>(bidsPath);
  return allBids.filter((bid) => bid.status === 'active');
}

export function createTransaction(transaction: TTransaction) {
  const transactionsPath = path.join(BASE_DATA_PATH, 'transactions.csv');
  appendToCSV(transactionsPath, transaction);
}

export function updateOfferStatus(timestamp: string, sellerId: string, newStatus: string) {
  const offersPath = path.join(BASE_DATA_PATH, 'offers.csv');
  const allOffers = readCSV<TOffer>(offersPath);
  const updatedOffers = allOffers.map((offer) => {
    if (offer.timestamp === timestamp && offer.seller_id === sellerId) {
      return { ...offer, status: newStatus };
    }
    return offer;
  });

  writeCSV(offersPath, updatedOffers);
}

export function updateBidStatus(timestamp: string, buyerId: string, newStatus: string) {
  const bidsPath = path.join(BASE_DATA_PATH, 'bids.csv');
  const allBids = readCSV<TBid>(bidsPath);
  const updatedBids = allBids.map((bid) => {
    if (bid.timestamp === timestamp && bid.buyer_id === buyerId) {
      return { ...bid, status: newStatus };
    }
    return bid;
  });

  writeCSV(bidsPath, updatedBids);
}

export function getAllEnergyDataForTimestamp(timestamp: string): TEnergyData[] {
  const dataPath = path.join(BASE_DATA_PATH, 'energy.csv');
  const allData = readCSV<TEnergyData>(dataPath);
  return allData.filter((row) => row.timestamp === timestamp);
}

export function saveMarketState(marketState: TMarketState) {
  const marketPath = path.join(BASE_DATA_PATH, 'market-state.csv');
  appendToCSV(marketPath, marketState);
}
