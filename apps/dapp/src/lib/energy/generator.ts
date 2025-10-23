/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable @typescript-eslint/restrict-template-expressions */

import db from '~/drizzle';
import { batteryStoragesSchema } from '~/drizzle/schemas/battery-storages';
import { consumerEnergyDataSchema } from '~/drizzle/schemas/consumer-energy-data';
import { electricVehiclesSchema } from '~/drizzle/schemas/electric-vehicles';
import { energyProfilesSchema } from '~/drizzle/schemas/energy-profiles';
import { energyReadingsSchema } from '~/drizzle/schemas/energy-readings';
import { producerEnergyDataSchema } from '~/drizzle/schemas/producer-energy-data';
import { prosumerEnergyDataSchema } from '~/drizzle/schemas/prosumer-energy-data';
import { usersSchema } from '~/drizzle/schemas/users';
import { vppAggregatedDataSchema } from '~/drizzle/schemas/vpp-aggregated-data';
import { desc, eq } from 'drizzle-orm';

import { initializeBatterySoc, simulateBatteryOperation } from './battery-management';
import { generateConsumptionProfile } from './consumption-profile';
import { initializeEVSoc, simulateEVCharging } from './ev-charging';
import { generateSolarProduction } from './solar-production';

/**
 * User energy profile data retrieved from database
 */
interface UserEnergyProfile {
  userId: number;
  address: string;
  energyProfileRole: string;
  dailyProductionKwh?: number;
  dailyConsumptionKwh?: number;
  batteryCapacityKwh?: number;
  evBatteryCapacityKwh?: number;
}

/**
 * Energy reading result for a single user
 */
interface EnergyReading {
  userId: number;
  timestamp: Date;
  productionKwh: number | null;
  consumptionKwh: number;
  batterySoc: number | null;
  evSoc: number | null;
  netBalance: number;
}

/**
 * Retrieves the last SOC (State of Charge) for battery from database
 * If no previous reading exists, initializes based on time of day
 */
async function getLastBatterySoc(userId: number, timestamp: Date): Promise<number> {
  const lastReading = await db.query.energyReadingsSchema.findFirst({
    where: eq(energyReadingsSchema.userId, userId),
    orderBy: desc(energyReadingsSchema.timestamp)
  });

  if (lastReading?.batterySoc) {
    return Number(lastReading.batterySoc);
  }

  return initializeBatterySoc(timestamp);
}

/**
 * Retrieves the last SOC (State of Charge) for EV from database
 * If no previous reading exists, initializes based on time of day
 */
async function getLastEVSoc(userId: number, timestamp: Date): Promise<number> {
  const lastReading = await db.query.energyReadingsSchema.findFirst({
    where: eq(energyReadingsSchema.userId, userId),
    orderBy: desc(energyReadingsSchema.timestamp)
  });

  if (lastReading?.evSoc) {
    return Number(lastReading.evSoc);
  }

  return initializeEVSoc(timestamp);
}

/**
 * Fetches all active users with their energy profiles from the database
 */
async function fetchAllUsers(): Promise<UserEnergyProfile[]> {
  const users = await db
    .select({
      userId: usersSchema.id,
      address: usersSchema.address,
      energyProfileId: usersSchema.energyProfileId
    })
    .from(usersSchema);

  const profiles: UserEnergyProfile[] = [];

  for (const user of users) {
    const energyProfile = await db.query.energyProfilesSchema.findFirst({
      where: eq(energyProfilesSchema.id, user.energyProfileId)
    });

    if (!energyProfile) continue;

    const profile: UserEnergyProfile = {
      userId: user.userId,
      address: user.address,
      energyProfileRole: energyProfile.role
    };

    // Fetch energy data based on profile type
    switch (energyProfile.role) {
      case 'consumer': {
        const consumerData = await db.query.consumerEnergyDataSchema.findFirst({
          where: eq(consumerEnergyDataSchema.energyProfileId, user.energyProfileId)
        });
        if (consumerData) {
          profile.dailyConsumptionKwh = Number(consumerData.expectedConsumptionKwh);
        }

        break;
      }
      case 'producer': {
        const producerData = await db.query.producerEnergyDataSchema.findFirst({
          where: eq(producerEnergyDataSchema.energyProfileId, user.energyProfileId)
        });
        if (producerData) {
          profile.dailyProductionKwh = Number(producerData.solarProductionKwh);
        }

        break;
      }
      case 'prosumer': {
        const prosumerData = await db.query.prosumerEnergyDataSchema.findFirst({
          where: eq(prosumerEnergyDataSchema.energyProfileId, user.energyProfileId)
        });
        if (prosumerData) {
          profile.dailyProductionKwh = Number(prosumerData.solarProductionKwh);
          profile.dailyConsumptionKwh = Number(prosumerData.expectedConsumptionKwh);
        }

        break;
      }
      // No default
    }

    // Fetch battery data if exists
    const batteryData = await db.query.batteryStoragesSchema.findFirst({
      where: eq(batteryStoragesSchema.energyProfileId, user.energyProfileId)
    });
    if (batteryData) {
      profile.batteryCapacityKwh = Number(batteryData.capacityKwh);
    }

    // Fetch EV data if exists
    const evData = await db.query.electricVehiclesSchema.findFirst({
      where: eq(electricVehiclesSchema.energyProfileId, user.energyProfileId)
    });
    if (evData) {
      profile.evBatteryCapacityKwh = Number(evData.batteryCapacityKwh);
    }

    profiles.push(profile);
  }

  return profiles;
}

/**
 * Generates energy reading for a single user at a given timestamp
 */
async function generateUserReading(
  user: UserEnergyProfile,
  timestamp: Date
): Promise<EnergyReading> {
  // Generate production (if applicable)
  let productionKwh: number | null = null;
  if (user.dailyProductionKwh) {
    productionKwh = generateSolarProduction(user.dailyProductionKwh, timestamp);
  }

  // Generate base consumption
  let consumptionKwh = 0;
  if (user.dailyConsumptionKwh) {
    consumptionKwh = generateConsumptionProfile(user.dailyConsumptionKwh, timestamp);
  }

  // EV charging simulation
  let evSoc: number | null = null;
  if (user.evBatteryCapacityKwh) {
    // Get last EV SOC from database
    const currentEvSoc = await getLastEVSoc(user.userId, timestamp);

    const evResult = simulateEVCharging({
      batteryCapacityKwh: user.evBatteryCapacityKwh,
      currentSoc: currentEvSoc,
      timestamp
    });

    consumptionKwh += evResult.consumptionKwh;
    evSoc = evResult.newSoc;
  }

  // Calculate net balance before battery
  const netBalanceBeforeBattery = (productionKwh ?? 0) - consumptionKwh;

  // Battery simulation
  let batterySoc: number | null = null;
  let batteryFlow = 0;
  if (user.batteryCapacityKwh) {
    // Get last battery SOC from database
    const currentBatterySoc = await getLastBatterySoc(user.userId, timestamp);

    const batteryResult = simulateBatteryOperation({
      capacityKwh: user.batteryCapacityKwh,
      currentSoc: currentBatterySoc,
      netEnergyBalance: netBalanceBeforeBattery
    });

    batterySoc = batteryResult.newSoc;
    batteryFlow = batteryResult.energyFlow;

    // Debug logs
    console.log(`[Generator] User ${user.userId} @ ${timestamp.toISOString()}:`, {
      production: productionKwh,
      consumption: consumptionKwh,
      netBalanceBeforeBattery,
      currentBatterySoc,
      newBatterySoc: batterySoc,
      batteryFlow,
      batteryCapacity: user.batteryCapacityKwh
    });
  }

  // Final net balance (accounting for battery flow)
  const netBalance = netBalanceBeforeBattery - batteryFlow;

  return {
    userId: user.userId,
    timestamp,
    productionKwh,
    consumptionKwh,
    batterySoc,
    evSoc,
    netBalance
  };
}

/**
 * Main function to generate energy data for all users and save to database
 */
export async function generateEnergyData(timestamp: Date): Promise<void> {
  console.log(`[Energy Generator] Generating data for timestamp: ${timestamp.toISOString()}`);

  // Fetch all users
  const users = await fetchAllUsers();
  console.log(`[Energy Generator] Found ${users.length} users`);

  if (users.length === 0) {
    console.log('[Energy Generator] No users found, skipping generation');
    return;
  }

  // Generate readings for all users
  const readings: EnergyReading[] = [];
  for (const user of users) {
    const reading = await generateUserReading(user, timestamp);
    readings.push(reading);
  }

  // Save individual readings to database
  for (const reading of readings) {
    await db.insert(energyReadingsSchema).values({
      userId: reading.userId,
      timestamp: reading.timestamp,
      productionKwh: reading.productionKwh?.toString() ?? null,
      consumptionKwh: reading.consumptionKwh.toString(),
      batterySoc: reading.batterySoc?.toString() ?? null,
      evSoc: reading.evSoc?.toString() ?? null,
      netBalance: reading.netBalance.toString()
    });
  }

  console.log(`[Energy Generator] Saved ${readings.length} individual readings`);

  // Calculate VPP aggregated data
  const totalProduction = readings.reduce((sum, r) => sum + (r.productionKwh ?? 0), 0);
  const totalConsumption = readings.reduce((sum, r) => sum + r.consumptionKwh, 0);
  const totalNetBalance = readings.reduce((sum, r) => sum + r.netBalance, 0);

  // Calculate battery aggregates
  const usersWithBattery = users.filter((u) => u.batteryCapacityKwh);
  const totalBatteryCapacity = usersWithBattery.reduce(
    (sum, u) => sum + (u.batteryCapacityKwh ?? 0),
    0
  );
  const avgBatterySoc =
    usersWithBattery.length > 0
      ? readings
          .filter((r) => r.batterySoc !== null)
          .reduce((sum, r) => sum + (r.batterySoc ?? 0), 0) / usersWithBattery.length
      : null;

  // Calculate EV aggregates
  const usersWithEv = users.filter((u) => u.evBatteryCapacityKwh);
  const totalEvCapacity = usersWithEv.reduce((sum, u) => sum + (u.evBatteryCapacityKwh ?? 0), 0);
  const avgEvSoc =
    usersWithEv.length > 0
      ? readings.filter((r) => r.evSoc !== null).reduce((sum, r) => sum + (r.evSoc ?? 0), 0) /
        usersWithEv.length
      : null;

  // Save VPP aggregated data
  await db.insert(vppAggregatedDataSchema).values({
    timestamp,
    totalProductionKwh: totalProduction.toString(),
    totalConsumptionKwh: totalConsumption.toString(),
    netBalance: totalNetBalance.toString(),
    totalBatteryCapacityKwh: totalBatteryCapacity.toString(),
    avgBatterySoc: avgBatterySoc?.toString() ?? null,
    totalEvCapacityKwh: totalEvCapacity.toString(),
    avgEvSoc: avgEvSoc?.toString() ?? null,
    activeUsersCount: users.length
  });

  console.log('[Energy Generator] Saved VPP aggregated data');
}
