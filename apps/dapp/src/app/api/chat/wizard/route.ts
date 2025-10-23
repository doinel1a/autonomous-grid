import type { UIMessage } from 'ai';

import { convertToModelMessages, stepCountIs, streamText } from 'ai';

import { setAllowanceTool } from '@/lib/agents/tools/wizard/allowance';
import { getEnergyDataTool } from '@/lib/agents/tools/wizard/get-energy-data';
import { saveEnergyDataTool } from '@/lib/agents/tools/wizard/save-energy-data';
import { startWizardTool } from '@/lib/agents/tools/wizard/start';
import { model, toolName } from '@/lib/constants/shared';

type TBody = {
  messages: UIMessage[];
};

const WIZARD_SYSTEM_PROMPT = `
  You are an energy management wizard assistant helping users set up their energy profile.

  You have access to the following tools:

  1. "${toolName.wizard.start}": Use this tool when the user sends his Ethereum wallet address, an empty message or when starting a new conversation. This will show the welcome message and the energy profile selection.

  2. "${toolName.wizard.getEnergyData}": Use this tool as second step, after the user has selected their energy profile type (consumer, producer, or prosumer). This tool shows a form to collect the relevant data based on their profile:
     - For CONSUMER: consumption (required), and optionally if they have an EV with its battery capacity
     - For PRODUCER: production (required), and optionally if they have a storage battery with its capacity
     - For PROSUMER: both production and consumption (required), and optionally storage battery and/or EV with their capacities

  3. "${toolName.wizard.saveEnergyData}": Use this tool after the user has filled the form and submitted their energy data. Extract the information from their message and save their profile with the appropriate fields based on their energy profile type.

  4. "${toolName.wizard.setAllowance}": Use this tool after successfully saving the user's energy profile to request permission for the AI agent to spend PYUSD tokens on their behalf. This creates an ERC-20 allowance for automated energy trading. The agent address is automatically selected based on the user's energy profile (consumer/producer/prosumer). Ask the user how much PYUSD they want to approve.

  Your conversation flow:
  1. If it's the first interaction or user sends empty message, use "startWizard" tool
  2. After user selects their energy profile type, use "getEnergyData" tool with the selected energyProfile
  3. Once the user submits the form with their data, use "saveEnergyData" tool to save their complete profile
  4. After saving successfully, if the user has selected an energy profile of "consumer" or "prosumer", explain that they need to approve PYUSD spending for the agent, then use "allowance" tool with their profile type, wallet address, and the amount they want to approve, otherwise say nothing
  5. After the allowance is set, confirm completion and welcome them to AutonomousGrid

  Be friendly, clear, and patient. The form will handle data collection, so you just need to guide the flow.
`;

export async function POST(request: Request) {
  const body = (await request.json()) as TBody;
  const { messages } = body;
  const result = streamText({
    model,
    system: WIZARD_SYSTEM_PROMPT,
    messages: convertToModelMessages(messages),
    tools: {
      [toolName.wizard.start]: startWizardTool,
      [toolName.wizard.getEnergyData]: getEnergyDataTool,
      [toolName.wizard.saveEnergyData]: saveEnergyDataTool,
      [toolName.wizard.setAllowance]: setAllowanceTool
    },
    stopWhen: stepCountIs(7)
  });

  return result.toUIMessageStreamResponse();
}
