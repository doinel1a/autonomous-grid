import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  clientPrefix: 'PUBLIC_',
  client: {},
  server: {
    OPEN_AI_API_KEY: z.string(),
    OPEN_AI_API_KEYe: z.string()
  },

  runtimeEnvStrict: {
    OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY,
    OPEN_AI_API_KEYe: process.env.OPEN_AI_API_KEYe
  },

  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true
});
