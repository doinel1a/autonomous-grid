import { integer, numeric, pgTable, timestamp } from 'drizzle-orm/pg-core';

import { energyProfilesSchema } from './energy-profiles';

export const electricVehiclesSchema = pgTable('electric_vehicles', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  energyProfileId: integer('energy_profile_id')
    .notNull()
    .unique()
    .references(() => energyProfilesSchema.id, { onDelete: 'cascade' }),
  batteryCapacityKwh: numeric('battery_capacity_kwh', { precision: 10, scale: 2 }).notNull(),

  createdAt: timestamp('created_at', { mode: 'date', precision: 3 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', precision: 3 }).$onUpdateFn(() => new Date())
});
