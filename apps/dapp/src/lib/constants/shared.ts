// import { openai } from '@ai-sdk/openai';
// export const model = openai('gpt-4o'); // Used w/ OpenAI - set OPENAI_API_KEY in .env file

export const model = 'openai/gpt-4o'; // Used w/ Vercel's AI Gateway - set AI_GATEWAY_API_KEY in .env file

export const assistantName = 'Sparky';

export type TEnergyProfile = (typeof energyProfile)[keyof typeof energyProfile];
export const energyProfile = {
  consumer: 'consumer',
  producer: 'producer',
  prosumer: 'prosumer'
} as const;

export const apiRoute = {
  wizard: '/api/chat/wizard'
} as const;

export const toolName = {
  wizard: {
    start: 'start-wizard',
    getEnergyData: 'get-energy-data',
    saveEnergyData: 'save-energy-data',
    setAllowance: 'set-allowance'
  }
} as const;

export const partToolName = {
  wizard: {
    start: `tool-${toolName.wizard.start}`,
    getEnergyData: `tool-${toolName.wizard.getEnergyData}`,
    saveEnergyData: `tool-${toolName.wizard.saveEnergyData}`,
    setAllowance: `tool-${toolName.wizard.setAllowance}`
  }
} as const;

export const unit = {
  kwh: 'kWh'
} as const;
