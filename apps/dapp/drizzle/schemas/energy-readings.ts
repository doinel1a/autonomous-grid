import { index, integer, numeric, pgTable, timestamp } from 'drizzle-orm/pg-core';

import { usersSchema } from './users';

export const energyReadingsSchema = pgTable(
  'energy_readings',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id')
      .notNull()
      .references(() => usersSchema.id, { onDelete: 'cascade' }),
    timestamp: timestamp({ mode: 'date', precision: 3 }).notNull(),
    productionKwh: numeric('production_kwh', { precision: 10, scale: 4 }),
    consumptionKwh: numeric('consumption_kwh', { precision: 10, scale: 4 }).notNull(),
    netBalance: numeric('net_balance', { precision: 10, scale: 4 }).notNull(),
    batterySoc: numeric('battery_soc', { precision: 5, scale: 2 }),
    evSoc: numeric('ev_soc', { precision: 5, scale: 2 }),

    createdAt: timestamp('created_at', { mode: 'date', precision: 3 }).notNull().defaultNow()
  },
  (table) => [
    index('energy_readings_user_id_idx').on(table.userId),
    index('energy_readings_timestamp_idx').on(table.timestamp),
    index('energy_readings_user_timestamp_idx').on(table.userId, table.timestamp)
  ]
);
