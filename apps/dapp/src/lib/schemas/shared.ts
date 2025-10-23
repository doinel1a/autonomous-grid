import z from 'zod';

import { energyProfile as energyProfileConstant } from '../constants/shared';

export const energyProfile = z
  .enum([
    energyProfileConstant.consumer,
    energyProfileConstant.producer,
    energyProfileConstant.prosumer
  ])
  .describe(
    "User's energy profile inside the Virtual Power Plant: consumer, producer, or prosumer"
  );

export const address = (description?: string) => {
  return z
    .string()
    .startsWith('0x')
    .length(42)
    .describe(description ?? "User's Ethereum wallet address");
};
