// import { openai } from '@ai-sdk/openai';

// export const model = openai('gpt-4o'); // User w/ OpenAI (OPENAI_API_KEY)
export const model = 'openai/gpt-4o'; // Use w/ Vercel's AI Gateway (AI_GATEWAY_API_KEY)

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
    start: 'startWizard',
    getEnergyData: 'getEnergyData',
    saveEnergyData: 'saveEnergyData'
  }
} as const;

export const partToolName = {
  wizard: {
    start: `tool-${toolName.wizard.start}`,
    getEnergyData: `tool-${toolName.wizard.getEnergyData}`,
    saveEnergyData: `tool-${toolName.wizard.saveEnergyData}`
  }
} as const;

export const unit = {
  kwh: 'kWh'
} as const;
