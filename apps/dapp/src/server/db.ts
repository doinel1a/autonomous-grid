import { energyProfilesSchema } from '~/drizzle/schemas/energy-profiles';
import { usersSchema } from '~/drizzle/schemas/users';
import { drizzle } from 'drizzle-orm/node-postgres';
import postgres from 'pg';

import { env } from '@/env';

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Pool | undefined;
};

const conn = globalForDb.conn ?? new postgres.Pool({ connectionString: env.DATABASE_URL });
if (env.NODE_ENV !== 'production') {
  globalForDb.conn = conn;
}

export const db = drizzle(conn, {
  schema: {
    usersSchema,
    energyProfilesSchema
  }
});
