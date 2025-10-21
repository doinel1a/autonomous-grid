export type TEnergyProfile = (typeof energyProfile)[keyof typeof energyProfile];
export const energyProfile = {
  consumer: 'consumer',
  producer: 'producer',
  prosumer: 'prosumer'
} as const;
