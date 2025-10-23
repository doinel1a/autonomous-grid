import { generateEnergyData } from '@/lib/energy/generator';
import { inngest } from '@/lib/inngest/client';

/**
 * Inngest function that generates synthetic energy data every 15 minutes
 * This cron job:
 * 1. Runs every 15 minutes
 * 2. Fetches all registered users
 * 3. Generates realistic production/consumption data
 * 4. Simulates battery and EV behavior
 * 5. Saves individual readings and VPP aggregates
 */
export const generateEnergyDataCron = inngest.createFunction(
  {
    id: 'generate-energy-data-cron',
    name: 'Generate Energy Data (15min intervals)'
  },
  {
    cron: '*/15 * * * *' // every 15 minutes
  },
  async ({ step }) => {
    console.log('[Inngest] Starting energy data generation cron job');

    // Get current timestamp (rounded to 15-minute interval)
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.floor(minutes / 5) * 5;
    const timestamp = new Date(now);
    timestamp.setMinutes(roundedMinutes, 0, 0);

    console.log(`[Inngest] Generating data for: ${timestamp.toISOString()}`);

    // Generate and save energy data
    await step.run('generate-data', async () => {
      try {
        await generateEnergyData(timestamp);
        console.log('[Inngest] Energy data generation completed successfully');
        return { success: true, timestamp: timestamp.toISOString() };
      } catch (error) {
        console.error('[Inngest] Error generating energy data:', error);
        throw error;
      }
    });

    return {
      message: 'Energy data generated successfully',
      timestamp: timestamp.toISOString()
    };
  }
);
