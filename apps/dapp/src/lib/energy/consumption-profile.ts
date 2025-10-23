/* eslint-disable sonarjs/pseudo-random */
/* eslint-disable sonarjs/cognitive-complexity */

/**
 * Generates residential energy consumption for a 15-minute interval
 * Uses a tri-modal distribution to simulate typical residential patterns:
 * - Morning peak (7-9h)
 * - Midday activity (12-14h)
 * - Evening peak (18-22h)
 * - Low nighttime consumption (23-6h)
 *
 * @param dailyConsumptionKwh - Total consumption expected in 24 hours (kWh)
 * @param timestamp - The timestamp for this reading
 * @returns Consumption in kWh for this 15-minute interval
 */
export function generateConsumptionProfile(dailyConsumptionKwh: number, timestamp: Date): number {
  const hour = timestamp.getHours();
  const minute = timestamp.getMinutes();
  const decimalHour = hour + minute / 60;
  const baseConsumptionPerHour = dailyConsumptionKwh / 24;

  // Calculate hourly multiplier based on time of day
  let multiplier: number;

  if (decimalHour >= 0 && decimalHour < 6) {
    // Night (00:00 - 06:00): very low consumption (20% of base)
    multiplier = 0.2;
  } else if (decimalHour >= 6 && decimalHour < 7) {
    // Early morning (06:00 - 07:00): ramping up (40% of base)
    multiplier = 0.4;
  } else if (decimalHour >= 7 && decimalHour < 9) {
    // Morning peak (07:00 - 09:00): high consumption (150% of base)
    multiplier = 1.5;
  } else if (decimalHour >= 9 && decimalHour < 12) {
    // Mid-morning (09:00 - 12:00): moderate consumption (70% of base)
    multiplier = 0.7;
  } else if (decimalHour >= 12 && decimalHour < 14) {
    // Lunch peak (12:00 - 14:00): elevated consumption (110% of base)
    multiplier = 1.1;
  } else if (decimalHour >= 14 && decimalHour < 17) {
    // Afternoon (14:00 - 17:00): moderate consumption (80% of base)
    multiplier = 0.8;
  } else if (decimalHour >= 17 && decimalHour < 18) {
    // Pre-evening (17:00 - 18:00): ramping up (120% of base)
    multiplier = 1.2;
  } else if (decimalHour >= 18 && decimalHour < 22) {
    // Evening peak (18:00 - 22:00): highest consumption (180% of base)
    multiplier = 1.8;
  } else {
    // Late evening (22:00 - 00:00): winding down (60% of base)
    multiplier = 0.6;
  }

  const intervalHours = 0.25; // 15 minutes
  let consumptionKwh = baseConsumptionPerHour * multiplier * intervalHours;

  const noiseRange = 0.1; // realistic variability (+-10% random noise)
  const noise = 1 + (Math.random() * 2 - 1) * noiseRange; // between 0.90 and 1.10
  consumptionKwh *= noise;

  return Math.max(0, consumptionKwh);
}
