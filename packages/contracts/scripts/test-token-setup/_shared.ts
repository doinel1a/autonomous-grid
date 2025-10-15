import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const localDeploymentPath = path.join(
  __dirname,
  '..',
  '..',
  'ignition',
  'deployments',
  'chain-31337',
  'deployed_addresses.json'
);

export const sepoliaDeploymentPath = path.join(
  __dirname,
  '..',
  '..',
  'ignition',
  'deployments',
  'chain-11155111',
  'deployed_addresses.json'
);

export const agentsPlaygroundPath = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'apps',
  'agents-playground',
  'contract-deployments'
);

export const artifactPath = path.join(
  __dirname,
  '..',
  '..',
  'artifacts',
  'contracts',
  'TestToken.sol',
  'TestToken.json'
);
