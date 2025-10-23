import { energyReadingsSchema } from '~/drizzle/schemas/energy-readings';
import { vppAggregatedDataSchema } from '~/drizzle/schemas/vpp-aggregated-data';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';

/**
 * Energy router - handles queries for energy readings and VPP data
 */
export const energyRouter = createTRPCRouter({
  /**
   * Get energy readings for a specific user
   * Supports pagination and date range filtering
   */
  getUserReadings: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        limit: z.number().min(1).max(100).default(96), // Default: 1 day (96 * 15min)
        offset: z.number().min(0).default(0),
        startDate: z.date().optional(),
        endDate: z.date().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const { userId, limit, offset, startDate, endDate } = input;

      // Build where conditions
      const conditions = [eq(energyReadingsSchema.userId, userId)];

      if (startDate) {
        conditions.push(gte(energyReadingsSchema.timestamp, startDate));
      }

      if (endDate) {
        conditions.push(lte(energyReadingsSchema.timestamp, endDate));
      }

      // Query readings
      const readings = await ctx.db
        .select()
        .from(energyReadingsSchema)
        .where(and(...conditions))
        .orderBy(desc(energyReadingsSchema.timestamp))
        .limit(limit)
        .offset(offset);

      // Get total count for pagination
      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(energyReadingsSchema)
        .where(and(...conditions));

      return {
        readings: readings.map((r) => ({
          id: r.id,
          userId: r.userId,
          timestamp: r.timestamp,
          productionKwh: r.productionKwh ? Number(r.productionKwh) : null,
          consumptionKwh: Number(r.consumptionKwh),
          netBalance: Number(r.netBalance),
          batterySoc: r.batterySoc ? Number(r.batterySoc) : null,
          evSoc: r.evSoc ? Number(r.evSoc) : null,
          createdAt: r.createdAt
        })),
        total: countResult?.count ?? 0,
        hasMore: (countResult?.count ?? 0) > offset + limit
      };
    }),

  /**
   * Get latest reading for a specific user
   */
  getUserLatestReading: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      const reading = await ctx.db.query.energyReadingsSchema.findFirst({
        where: eq(energyReadingsSchema.userId, input.userId),
        orderBy: desc(energyReadingsSchema.timestamp)
      });

      if (!reading) return null;

      return {
        id: reading.id,
        userId: reading.userId,
        timestamp: reading.timestamp,
        productionKwh: reading.productionKwh ? Number(reading.productionKwh) : null,
        consumptionKwh: Number(reading.consumptionKwh),
        netBalance: Number(reading.netBalance),
        batterySoc: reading.batterySoc ? Number(reading.batterySoc) : null,
        evSoc: reading.evSoc ? Number(reading.evSoc) : null,
        createdAt: reading.createdAt
      };
    }),

  /**
   * Get VPP aggregated data
   * Returns aggregated energy metrics for the entire Virtual Power Plant
   */
  getVPPAggregated: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(96), // Default: 1 day
        offset: z.number().min(0).default(0),
        startDate: z.date().optional(),
        endDate: z.date().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset, startDate, endDate } = input;

      // Build where conditions
      const conditions = [];

      if (startDate) {
        conditions.push(gte(vppAggregatedDataSchema.timestamp, startDate));
      }

      if (endDate) {
        conditions.push(lte(vppAggregatedDataSchema.timestamp, endDate));
      }

      // Query aggregated data
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const aggregates = await ctx.db
        .select()
        .from(vppAggregatedDataSchema)
        .where(whereClause)
        .orderBy(desc(vppAggregatedDataSchema.timestamp))
        .limit(limit)
        .offset(offset);

      // Get total count
      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(vppAggregatedDataSchema)
        .where(whereClause);

      return {
        data: aggregates.map((a) => ({
          id: a.id,
          timestamp: a.timestamp,
          totalProductionKwh: Number(a.totalProductionKwh),
          totalConsumptionKwh: Number(a.totalConsumptionKwh),
          netBalance: Number(a.netBalance),
          totalBatteryCapacityKwh: Number(a.totalBatteryCapacityKwh),
          avgBatterySoc: a.avgBatterySoc ? Number(a.avgBatterySoc) : null,
          totalEvCapacityKwh: Number(a.totalEvCapacityKwh),
          avgEvSoc: a.avgEvSoc ? Number(a.avgEvSoc) : null,
          activeUsersCount: a.activeUsersCount,
          createdAt: a.createdAt
        })),
        total: countResult?.count ?? 0,
        hasMore: (countResult?.count ?? 0) > offset + limit
      };
    }),

  /**
   * Get latest VPP snapshot
   */
  getVPPLatest: protectedProcedure.query(async ({ ctx }) => {
    const latest = await ctx.db.query.vppAggregatedDataSchema.findFirst({
      orderBy: desc(vppAggregatedDataSchema.timestamp)
    });

    if (!latest) return null;

    return {
      id: latest.id,
      timestamp: latest.timestamp,
      totalProductionKwh: Number(latest.totalProductionKwh),
      totalConsumptionKwh: Number(latest.totalConsumptionKwh),
      netBalance: Number(latest.netBalance),
      totalBatteryCapacityKwh: Number(latest.totalBatteryCapacityKwh),
      avgBatterySoc: latest.avgBatterySoc ? Number(latest.avgBatterySoc) : null,
      totalEvCapacityKwh: Number(latest.totalEvCapacityKwh),
      avgEvSoc: latest.avgEvSoc ? Number(latest.avgEvSoc) : null,
      activeUsersCount: latest.activeUsersCount,
      createdAt: latest.createdAt
    };
  })
});
