import { batteryStoragesSchema } from '~/drizzle/schemas/battery-storages';
import { consumerEnergyDataSchema } from '~/drizzle/schemas/consumer-energy-data';
import { electricVehiclesSchema } from '~/drizzle/schemas/electric-vehicles';
import { energyProfilesSchema } from '~/drizzle/schemas/energy-profiles';
import { energyReadingsSchema } from '~/drizzle/schemas/energy-readings';
import { producerEnergyDataSchema } from '~/drizzle/schemas/producer-energy-data';
import { prosumerEnergyDataSchema } from '~/drizzle/schemas/prosumer-energy-data';
import { usersSchema } from '~/drizzle/schemas/users';
import { vppAggregatedDataSchema } from '~/drizzle/schemas/vpp-aggregated-data';
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
    energyProfilesSchema,
    consumerEnergyDataSchema,
    producerEnergyDataSchema,
    prosumerEnergyDataSchema,
    batteryStoragesSchema,
    electricVehiclesSchema,
    energyReadingsSchema,
    vppAggregatedDataSchema
  }
});
