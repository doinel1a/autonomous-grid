import fs from 'fs';
import path from 'path';

import { network } from 'hardhat';
import { Address, formatEther, parseEther } from 'viem';

import { agentsPlaygroundPath, artifactPath, localDeploymentPath } from './_shared.js';

/**
 * Post-deployment setup script for local
 * Distributes D1A tokens to test accounts and saves configuration information
 */
async function main() {
  console.log('🚀 Starting "TestToken" Local setup...');
  console.log('\n');

  const { viem } = await network.connect({
    network: 'localhost',
    chainType: 'l1'
  });

  const client = await viem.getPublicClient();
  const [deployer, account1, account2] = await viem.getWalletClients();

  console.log('📝 Deployer account:', deployer.account.address);
  const deployerBalance = await client.getBalance({ address: deployer.account.address });
  console.log('💰 Deployer balance:', formatEther(deployerBalance), 'ETH');
  console.log('\n');

  if (!fs.existsSync(localDeploymentPath)) {
    console.error('❌ Error: TestToken contract not deployed locally');
    console.error('Run: pnpm deploy:testToken:local');
    process.exit(1);
  }

  const deployedAddresses = JSON.parse(fs.readFileSync(localDeploymentPath, 'utf-8'));
  const contractAddress = deployedAddresses['TestTokenModule#TestToken'] as Address;
  console.log('📄 TestToken contract:', contractAddress);

  const contract = await viem.getContractAt('TestToken', contractAddress);
  const totalSupply = await contract.read.totalSupply();
  console.log('📊 Total supply:', formatEther(totalSupply), 'D1A');
  console.log('\n');

  console.log('💸 Transferring initial tokens to test accounts...');
  const transferAmount = parseEther('10000');

  const txHash1 = await contract.write.transfer([account1.account.address, transferAmount]);
  await client.waitForTransactionReceipt({ hash: txHash1 });
  console.log(`🔘 ${formatEther(transferAmount)} D1A to ${account1.account.address}`);

  const txHash2 = await contract.write.transfer([account2.account.address, transferAmount]);
  await client.waitForTransactionReceipt({ hash: txHash2 });
  console.log(`🔘 ${formatEther(transferAmount)} D1A to ${account2.account.address}`);
  console.log('\n');

  console.log('📊 Final balances:');
  const balanceDeployer = await contract.read.balanceOf([deployer.account.address]);
  const balanceAccount1 = await contract.read.balanceOf([account1.account.address]);
  const balanceAccount2 = await contract.read.balanceOf([account2.account.address]);
  console.log('🔘 Deployer:', formatEther(balanceDeployer), 'D1A');
  console.log('🔘 Account1:', formatEther(balanceAccount1), 'D1A');
  console.log('🔘 Account2:', formatEther(balanceAccount2), 'D1A');
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

  const config = generateAgentConfig(contractAddress, abi);
  fs.writeFileSync(path.join(agentsPlaygroundPath, 'local.ts'), config);

  console.log('✨ Local setup completed successfully!');
}

function generateAgentConfig(contractAddress: Address, abi: unknown) {
  const config = {
    network: 'localhost',
    rpcUrl: 'http://127.0.0.1:8545',
    contractAddress,
    accounts: {
      deployer: {
        address: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
        privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
      },
      account1: {
        address: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
        privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
      },
      account2: {
        address: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
        privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
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
    console.error('❌ Error during "TestToken" Local setup:', error);
    process.exit(1);
  });
