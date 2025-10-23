/* eslint-disable sonarjs/pseudo-random */

type TBatteryConfiguration = {
  capacityKwh: number;
  currentSoc: number; // soc = state of charge
  netEnergyBalance: number; // production - consumption (positive = surplus, negative = deficit)
};

export type TBatteryOperation = {
  energyFlow: number; // positive = charging, negative = discharging
  newSoc: number;
  isCharging: boolean;
  isDischarging: boolean;
};

/**
 * Simulates battery storage behavior for a 15-minute interval
 * Logic:
 * - Charges when production > consumption (energy surplus)
 * - Discharges when consumption > production (energy deficit)
 * - Maintains SOC between 10% (minimum) and 90% (maximum) for battery health
 * - Maximum charge/discharge rate: 0.5C (50% of capacity per hour)
 *
 * @param config - Battery configuration
 * @returns Battery operation results
 */
export function simulateBatteryOperation(config: TBatteryConfiguration): TBatteryOperation {
  const { capacityKwh, currentSoc, netEnergyBalance } = config;

  // Battery SOC limits for longevity
  const minSoc = 10; // Don't discharge below 10%
  const maxSoc = 90; // Don't charge above 90%

  // Maximum charge/discharge rate: 0.5C (50% of capacity per hour)
  const maxCRate = 0.5;
  const intervalHours = 0.25; // 15 minutes
  const maxEnergyFlowKwh = capacityKwh * maxCRate * intervalHours;

  let energyFlow = 0;
  let newSoc = currentSoc;
  let isCharging = false;
  let isDischarging = false;

  // Case 1: Surplus energy (production > consumption) => Charge battery
  if (netEnergyBalance > 0 && currentSoc < maxSoc) {
    const chargingEfficiency = 0.92;

    // Available space in battery (actual energy that can be stored)
    const availableSpaceKwh = ((maxSoc - currentSoc) / 100) * capacityKwh;

    // Energy needed from grid to fill that space (accounting for efficiency loss)
    const energyNeededToFillSpace = availableSpaceKwh / chargingEfficiency;

    // Energy to charge: minimum of surplus, max rate, and energy needed to fill
    energyFlow = Math.min(netEnergyBalance, maxEnergyFlowKwh, energyNeededToFillSpace);

    // Actual energy stored in battery (after efficiency loss)
    const actualEnergyStored = energyFlow * chargingEfficiency;

    const socIncrease = (actualEnergyStored / capacityKwh) * 100;
    newSoc = Math.min(currentSoc + socIncrease, maxSoc);

    isCharging = true;
  }
  // Case 2: Energy deficit (consumption > production) => Discharge battery
  else if (netEnergyBalance < 0 && currentSoc > minSoc) {
    const dischargingEfficiency = 0.92;
    const energyDeficit = Math.abs(netEnergyBalance);

    // Available energy in battery (stored energy that can be extracted)
    const availableEnergyKwh = ((currentSoc - minSoc) / 100) * capacityKwh;

    // Energy that can be delivered to the load (accounting for efficiency loss)
    const maxEnergyDeliverable = availableEnergyKwh * dischargingEfficiency;

    // Energy to deliver: minimum of deficit, max rate, and max deliverable
    const energyToDeliver = Math.min(energyDeficit, maxEnergyFlowKwh, maxEnergyDeliverable);

    // Actual energy taken from battery (more than delivered due to efficiency loss)
    const actualEnergyFromBattery = energyToDeliver / dischargingEfficiency;

    const socDecrease = (actualEnergyFromBattery / capacityKwh) * 100;
    newSoc = Math.max(currentSoc - socDecrease, minSoc);

    // Negative value indicates discharging
    energyFlow = -energyToDeliver;

    isDischarging = true;
  }

  return {
    energyFlow,
    newSoc,
    isCharging,
    isDischarging
  };
}

/**
 * Initializes battery SOC based on time of day
 * Simulates realistic battery state at different times
 *
 * @param timestamp - Current timestamp
 * @returns Initial SOC percentage
 */
export function initializeBatterySoc(timestamp: Date): number {
  const hour = timestamp.getHours();

  // Morning (after potential night charging from grid/solar): high SOC
  if (hour >= 6 && hour < 10) {
    return 60 + Math.random() * 25; // 60-85%
  }
  // Midday (during solar production): very high SOC
  else if (hour >= 10 && hour < 16) {
    return 70 + Math.random() * 20; // 70-90%
  }
  // Evening (after day's consumption, before night): medium-low SOC
  else if (hour >= 18 && hour < 22) {
    return 30 + Math.random() * 30; // 30-60%
  }
  // Night (after evening consumption): low-medium SOC
  else if (hour >= 22 || hour < 6) {
    return 20 + Math.random() * 40; // 20-60%
  }

  // Default: medium SOC
  return 40 + Math.random() * 30; // 40-70%
}
