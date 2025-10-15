import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  clientPrefix: 'PUBLIC_',
  client: {},
  server: {
    OPEN_AI_API_KEY: z.string(),
    SEPOLIA_RPC_URL: z.url(),
    WALLET_1_PRIVATE_KEY: z.url(),
    WALLET_2_PRIVATE_KEY: z.url()
  },

  runtimeEnvStrict: {
    OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY,
    SEPOLIA_RPC_URL: process.env.SEPOLIA_RPC_URL,
    WALLET_1_PRIVATE_KEY: process.env.WALLET_1_PRIVATE_KEY,
    WALLET_2_PRIVATE_KEY: process.env.WALLET_2_PRIVATE_KEY
  },

  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true
});
