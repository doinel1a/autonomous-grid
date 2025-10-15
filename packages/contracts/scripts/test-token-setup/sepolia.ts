import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { network } from 'hardhat';
import { Address, formatEther } from 'viem';

import { agentsPlaygroundPath, artifactPath, sepoliaDeploymentPath } from './_shared.js';

/**
 * Post-deployment setup script for Sepolia
 * Saves configuration information for Sepolia deployment
 */
async function main() {
  console.log('🚀 Starting "TestToken" Sepolia setup...');
  console.log('\n');

  const { viem } = await network.connect({
    network: 'sepolia',
    chainType: 'l1'
  });

  const client = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  console.log('📝 Deployer account:', deployer.account.address);
  const deployerBalance = await client.getBalance({ address: deployer.account.address });
  console.log('💰 Deployer balance:', formatEther(deployerBalance), 'ETH');
  console.log('\n');

  if (!fs.existsSync(sepoliaDeploymentPath)) {
    console.error('❌ Error: TestToken contract not deployed on Sepolia');
    console.error('Run: pnpm deploy:testToken:sepolia');
    process.exit(1);
  }

  const deployedAddresses = JSON.parse(fs.readFileSync(sepoliaDeploymentPath, 'utf-8'));
  const contractAddress = deployedAddresses['TestTokenModule#TestToken'] as Address;
  console.log('📄 TestToken contract:', contractAddress);

  const contract = await viem.getContractAt('TestToken', contractAddress);
  const totalSupply = await contract.read.totalSupply();
  console.log('📊 Total supply:', formatEther(totalSupply), 'D1A');
  console.log('\n');

  console.log('📊 Deployer balance:');
  const balanceDeployer = await contract.read.balanceOf([deployer.account.address]);
  console.log('🔘 Deployer:', formatEther(balanceDeployer), 'D1A');
  console.log('\n');

  if (!fs.existsSync(artifactPath)) {
    console.error('❌ Error: Contract artifact not found');
    console.error('Run: pnpm compile');
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
  const abi = artifact.abi;

  if (!fs.existsSync(agentsPlaygroundPath)) {
    fs.mkdirSync(agentsPlaygroundPath, { recursive: true });
  }

  const config = generateAgentConfig(contractAddress, deployer.account.address, abi);
  fs.writeFileSync(path.join(agentsPlaygroundPath, 'sepolia.ts'), config);

  console.log('✨ Sepolia setup completed successfully!');
}

function generateAgentConfig(contractAddress: Address, deployerAddress: Address, abi: unknown) {
  const config = {
    network: 'sepolia',
    chainId: 11155111,
    rpcUrl: 'Get SEPOLIA_RPC_URL from .env file',
    contractAddress,
    accounts: {
      deployer: {
        address: deployerAddress,
        privateKey: 'Get SEPOLIA_PRIVATE_KEY from .env file'
      }
    },
    abi,
    setupAt: new Date().toISOString()
  };

  return `
    // Auto-generated file - Do not edit manually
    // Generated at: ${new Date().toISOString()}

    export const config = ${JSON.stringify(config, null, 2)} as const;
  `;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error during "TestToken" Sepolia setup:', error);
    process.exit(1);
  });
