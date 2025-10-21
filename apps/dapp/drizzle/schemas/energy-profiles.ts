import { index, integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

import { usersSchema } from './users';

export const energyProfilesSchema = pgTable(
  'energy_profiles',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id')
      .notNull()
      .unique()
      .references(() => usersSchema.id, { onDelete: 'cascade' }),
    role: varchar({ length: 50 }).notNull(),

    createdAt: timestamp('created_at', { mode: 'date', precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', precision: 3 }).$onUpdateFn(() => new Date())
  },
  (table) => [index('energy_profiles_role_idx').on(table.role)]
);
