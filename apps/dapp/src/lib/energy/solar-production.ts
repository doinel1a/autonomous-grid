/* eslint-disable sonarjs/pseudo-random */

/**
 * Generates solar production for a 15-minute interval based on daily production target
 * Uses a sinusoidal curve to simulate realistic solar generation pattern
 *
 * @param dailyProductionKwh - Total production expected in 24 hours (kWh)
 * @param timestamp - The timestamp for this reading
 * @returns Production in kWh for this 15-minute interval
 */
export function generateSolarProduction(dailyProductionKwh: number, timestamp: Date): number {
  const hour = timestamp.getHours();
  const minute = timestamp.getMinutes();
  const decimalHour = hour + minute / 60;

  // Solar production only happens between 6:00 and 18:00 (12 hours)
  const sunriseHour = 6;
  const sunsetHour = 18;

  // No production outside daylight hours
  if (decimalHour < sunriseHour || decimalHour >= sunsetHour) {
    return 0;
  }

  // Calculate peak power: assuming 5 effective sun hours per day
  // (total daily production happens in ~5 peak sun hours equivalent)
  const effectiveSunHours = 5;
  const peakPowerKw = dailyProductionKwh / effectiveSunHours;

  // Create sinusoidal curve with peak at solar noon (12:00)
  const dayLightHours = sunsetHour - sunriseHour;

  // Calculate position in the day (0 to π)
  const anglePosition = ((decimalHour - sunriseHour) / dayLightHours) * Math.PI;

  // Sinusoidal curve: 0 at sunrise/sunset, peak at solar noon
  const solarIntensityFactor = Math.sin(anglePosition);

  // Calculate production for 15 minutes (0.25 hours)
  const intervalHours = 0.25;
  let productionKwh = peakPowerKw * solarIntensityFactor * intervalHours;

  // Add realistic variability (±15% random noise to simulate clouds, etc.)
  const noiseRange = 0.15;
  const noise = 1 + (Math.random() * 2 - 1) * noiseRange; // Random between 0.85 and 1.15
  productionKwh *= noise;

  // Ensure non-negative
  return Math.max(0, productionKwh);
}
