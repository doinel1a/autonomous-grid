import { index, integer, numeric, pgTable, timestamp } from 'drizzle-orm/pg-core';

export const vppAggregatedDataSchema = pgTable(
  'vpp_aggregated_data',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    timestamp: timestamp({ mode: 'date', precision: 3 }).notNull().unique(),
    totalProductionKwh: numeric('total_production_kwh', { precision: 12, scale: 4 }).notNull(),
    totalConsumptionKwh: numeric('total_consumption_kwh', {
      precision: 12,
      scale: 4
    }).notNull(),
    netBalance: numeric('net_balance', { precision: 12, scale: 4 }).notNull(),
    totalBatteryCapacityKwh: numeric('total_battery_capacity_kwh', {
      precision: 12,
      scale: 2
    }).notNull(),
    avgBatterySoc: numeric('avg_battery_soc', { precision: 5, scale: 2 }), // Average State of Charge in %
    totalEvCapacityKwh: numeric('total_ev_capacity_kwh', { precision: 12, scale: 2 }).notNull(),
    avgEvSoc: numeric('avg_ev_soc', { precision: 5, scale: 2 }), // Average State of Charge in %
    activeUsersCount: integer('active_users_count').notNull(),

    createdAt: timestamp('created_at', { mode: 'date', precision: 3 }).notNull().defaultNow()
  },
  (table) => [
    index('vpp_aggregated_data_timestamp_idx').on(table.timestamp),
    index('vpp_aggregated_data_created_at_idx').on(table.createdAt)
  ]
);
