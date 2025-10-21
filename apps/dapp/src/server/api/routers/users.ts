import { usersSchema } from '~/drizzle/schemas/users';
import { eq } from 'drizzle-orm';
import z from 'zod';

import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';

const input = z.object({
  address: z.string()
});

export const usersRouter = createTRPCRouter({
  getByAddress: protectedProcedure.input(input).query(async ({ ctx, input }) => {
    const user = await ctx.db.query.usersSchema.findFirst({
      where: eq(usersSchema.address, input.address)
    });

    return user ?? null;
  })
});
