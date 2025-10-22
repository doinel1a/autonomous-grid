import { TRPCError } from '@trpc/server';
import { batteryStoragesSchema } from '~/drizzle/schemas/battery-storages';
import { consumerEnergyDataSchema } from '~/drizzle/schemas/consumer-energy-data';
import { electricVehiclesSchema } from '~/drizzle/schemas/electric-vehicles';
import { energyProfilesSchema } from '~/drizzle/schemas/energy-profiles';
import { producerEnergyDataSchema } from '~/drizzle/schemas/producer-energy-data';
import { prosumerEnergyDataSchema } from '~/drizzle/schemas/prosumer-energy-data';
import { usersSchema } from '~/drizzle/schemas/users';
import { eq } from 'drizzle-orm';
import z from 'zod';

import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';

const getByAddressInput = z.object({
  address: z.string()
});

const saveWizardDataInput = z.object({
  address: z.string(),
  energyProfile: z.enum(['consumer', 'producer', 'prosumer']),
  production: z.number().optional(),
  consumption: z.number().optional(),
  storageBatteryCapacity: z.number().optional(),
  evBatteryCapacity: z.number().optional()
});

export const usersRouter = createTRPCRouter({
  create: protectedProcedure.input(saveWizardDataInput).mutation(async ({ ctx, input }) => {
    const {
      address,
      energyProfile,
      production,
      consumption,
      storageBatteryCapacity,
      evBatteryCapacity
    } = input;

    return await ctx.db.transaction(async (tx) => {
      const energyProfileRecord = await tx.query.energyProfilesSchema.findFirst({
        where: eq(energyProfilesSchema.role, energyProfile)
      });

      if (!energyProfileRecord) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Energy profile not found' });
      }

      const energyProfileId = energyProfileRecord.id;

      if (energyProfile === 'consumer' && consumption !== undefined) {
        await tx
          .insert(consumerEnergyDataSchema)
          .values({
            energyProfileId,
            expectedConsumptionKwh: consumption.toString()
          })
          .onConflictDoUpdate({
            target: consumerEnergyDataSchema.energyProfileId,
            set: { expectedConsumptionKwh: consumption.toString() }
          });
      } else if (energyProfile === 'producer' && production !== undefined) {
        await tx
          .insert(producerEnergyDataSchema)
          .values({
            energyProfileId,
            solarProductionKwh: production.toString()
          })
          .onConflictDoUpdate({
            target: producerEnergyDataSchema.energyProfileId,
            set: { solarProductionKwh: production.toString() }
          });
      } else if (
        energyProfile === 'prosumer' &&
        production !== undefined &&
        consumption !== undefined
      ) {
        await tx
          .insert(prosumerEnergyDataSchema)
          .values({
            energyProfileId,
            solarProductionKwh: production.toString(),
            expectedConsumptionKwh: consumption.toString()
          })
          .onConflictDoUpdate({
            target: prosumerEnergyDataSchema.energyProfileId,
            set: {
              solarProductionKwh: production.toString(),
              expectedConsumptionKwh: consumption.toString()
            }
          });
      }

      if (storageBatteryCapacity !== undefined) {
        await tx
          .insert(batteryStoragesSchema)
          .values({
            energyProfileId,
            capacityKwh: storageBatteryCapacity.toString()
          })
          .onConflictDoUpdate({
            target: batteryStoragesSchema.energyProfileId,
            set: { capacityKwh: storageBatteryCapacity.toString() }
          });
      }

      if (evBatteryCapacity !== undefined) {
        await tx
          .insert(electricVehiclesSchema)
          .values({
            energyProfileId,
            batteryCapacityKwh: evBatteryCapacity.toString()
          })
          .onConflictDoUpdate({
            target: electricVehiclesSchema.energyProfileId,
            set: { batteryCapacityKwh: evBatteryCapacity.toString() }
          });
      }

      return await tx.insert(usersSchema).values({ address, energyProfileId }).returning();
    });
  }),
  getByAddress: protectedProcedure.input(getByAddressInput).query(async ({ ctx, input }) => {
    const user = await ctx.db.query.usersSchema.findFirst({
      where: eq(usersSchema.address, input.address)
    });

    return user ?? null;
  })
});
