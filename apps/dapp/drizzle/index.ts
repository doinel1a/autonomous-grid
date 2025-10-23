import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { env } from '@/env';

import { batteryStoragesSchema } from './schemas/battery-storages';
import { consumerEnergyDataSchema } from './schemas/consumer-energy-data';
import { electricVehiclesSchema } from './schemas/electric-vehicles';
import { energyProfilesSchema } from './schemas/energy-profiles';
import { energyReadingsSchema } from './schemas/energy-readings';
import { producerEnergyDataSchema } from './schemas/producer-energy-data';
import { prosumerEnergyDataSchema } from './schemas/prosumer-energy-data';
import { usersSchema } from './schemas/users';
import { vppAggregatedDataSchema } from './schemas/vpp-aggregated-data';

const pool = new Pool({
  connectionString: env.DATABASE_URL
});

const db = drizzle({
  client: pool,
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

export default db;
