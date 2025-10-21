import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

import { energyProfilesSchema } from './energy-profiles';

export const usersSchema = pgTable('users', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  address: varchar({ length: 255 }).notNull().unique(),
  energyProfileId: integer('energy_profile_id')
    .notNull()
    .references(() => energyProfilesSchema.id, { onDelete: 'restrict' }),

  createdAt: timestamp('created_at', { mode: 'date', precision: 3 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', precision: 3 }).$onUpdateFn(() => new Date())
});
