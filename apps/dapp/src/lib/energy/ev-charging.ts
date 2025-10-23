/* eslint-disable sonarjs/no-duplicated-branches */
/* eslint-disable sonarjs/pseudo-random */

export type TEVState = {
  soc: number;
  isCharging: boolean;
};

type TEVChargingConfiguration = {
  batteryCapacityKwh: number;
  currentSoc: number; // Current State of Charge (0-100%)
  timestamp: Date;
};

/**
 * Simulates EV charging for a 15-minute interval
 * Typical residential charging behavior:
 * - 80% probability of evening charging (18:00-23:00)
 * - Uses standard home charger (7kW)
 * - Charges until 80% SOC to preserve battery health
 * - 20% probability of starting charging if SOC < 50%
 *
 * @param config - EV charging configuration
 * @returns Object with consumption (kWh) and new SOC (%)
 */
export function simulateEVCharging(config: TEVChargingConfiguration): {
  consumptionKwh: number;
  newSoc: number;
  isCharging: boolean;
} {
  const { batteryCapacityKwh, currentSoc, timestamp } = config;
  const hour = timestamp.getHours();
  const targetSoc = 80;

  // If already at or above target, no charging
  if (currentSoc >= targetSoc) {
    return {
      consumptionKwh: 0,
      newSoc: currentSoc,
      isCharging: false
    };
  }

  let shouldCharge = false;

  // Evening charging window (18:00 - 23:00): high probability
  if (hour >= 18 && hour < 23) {
    // 80% chance to start charging if SOC < 50%
    if (currentSoc < 50 && Math.random() < 0.8) {
      shouldCharge = true;
    }
    // 40% chance to start charging if SOC between 50-70%
    else if (currentSoc >= 50 && currentSoc < 70 && Math.random() < 0.4) {
      shouldCharge = true;
    }
  }
  // Night charging (23:00 - 06:00): moderate probability (cheaper rates)
  else if ((hour >= 23 || hour < 6) && currentSoc < 60 && Math.random() < 0.5) {
    shouldCharge = true;
  }

  if (!shouldCharge) {
    return {
      consumptionKwh: 0,
      newSoc: currentSoc,
      isCharging: false
    };
  }

  const chargerPowerKw = 7; // standard residential charger: 7kW (Level 2)
  const intervalHours = 0.25; // 15 minutes
  const energyAddedKwh = chargerPowerKw * intervalHours;

  const socIncrease = (energyAddedKwh / batteryCapacityKwh) * 100;
  const newSoc = Math.min(currentSoc + socIncrease, targetSoc);
  const actualEnergyKwh = ((newSoc - currentSoc) / 100) * batteryCapacityKwh;

  return {
    consumptionKwh: Math.max(0, actualEnergyKwh),
    newSoc,
    isCharging: true
  };
}

/**
 * Initializes EV state based on time of day
 * Simulates realistic SOC at different times
 *
 * @param timestamp - Current timestamp
 * @returns Initial SOC percentage
 */
export function initializeEVSoc(timestamp: Date): number {
  const hour = timestamp.getHours();

  // Morning (after overnight charging): high SOC
  if (hour >= 6 && hour < 9) {
    return 70 + Math.random() * 20; // 70-90%
  }
  // Afternoon (after morning commute): medium-low SOC
  else if (hour >= 17 && hour < 20) {
    return 30 + Math.random() * 30; // 30-60%
  }
  // Evening (before charging): low-medium SOC
  else if (hour >= 20 && hour < 23) {
    return 20 + Math.random() * 40; // 20-60%
  }
  // Default: medium SOC
  return 40 + Math.random() * 30; // 40-70%
}
