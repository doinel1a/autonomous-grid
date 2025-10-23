import { energyRouter } from './routers/energy';
import { usersRouter } from './routers/users';
import { createCallerFactory, createTRPCRouter } from './trpc';

export const appRouter = createTRPCRouter({
  users: usersRouter,
  energy: energyRouter
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
