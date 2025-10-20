export type TUserType = 'producer' | 'prosumer' | 'consumer';
export type TUserId = 'maria' | 'pietro' | 'lucia';

export type TEnergyData = {
  timestamp: string;
  user_id: string;
  user_type: string;
  solar_production_kwh: number;
  consumption_kwh: number;
  battery_capacity_kwh: number;
  battery_level_kwh: number;
  grid_price_eur_kwh: number;
};

export type TMarketState = {
  timestamp: string;
  total_supply_kwh: number;
  total_demand_kwh: number;
  vpp_price_eur_kwh: number;
  balance_kwh: number;
};

export type TOffer = {
  timestamp: string;
  seller_id: string;
  kwh_available: number;
  price_eur_kwh: number;
  status: string;
};

export type TBid = {
  timestamp: string;
  buyer_id: string;
  kwh_needed: number;
  max_price_eur_kwh: number;
  status: string;
};

export type TTransaction = {
  timestamp: string;
  seller_id: string;
  buyer_id: string;
  kwh: number;
  price_eur_kwh: number;
  total_eur: number;
  tx_type: string;
};
