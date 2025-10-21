import { index, integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

export const energyProfilesSchema = pgTable(
  'energy_profiles',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    role: varchar({ length: 50 }).notNull().unique(),

    createdAt: timestamp('created_at', { mode: 'date', precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', precision: 3 }).$onUpdateFn(() => new Date())
  },
  (table) => [index('energy_profiles_role_idx').on(table.role)]
);
