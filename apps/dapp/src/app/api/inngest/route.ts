import { serve } from 'inngest/next';

import { inngest } from '@/lib/inngest/client';
import { generateEnergyDataCron } from '@/lib/inngest/functions/generate-energy-data';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateEnergyDataCron]
});
