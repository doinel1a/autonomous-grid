import 'dotenv/config';

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { Client, ContractCreateFlow, ContractFunctionParameters, PrivateKey } from '@hashgraph/sdk';
import { ethers } from 'ethers';

/**
 * Deploys the SPARKController smart contract to Hedera
 *
 * Prerequisites:
 * - SPARK token must be created first (run: npm run create:spark)
 * - TESTNET_SPARK_TOKEN_ID must be set in .env
 *
 * The contract will be deployed and configured with the SPARK token address
 */
async function deploySPARKController() {
  console.log('🚀 Deploying SPARKController to Hedera...\n');

  // Validate environment variables
  const network = process.env.HEDERA_NETWORK;
  const accountId = process.env.HEDERA_TESTNET_ACCOUNT_ID;
  const privateKeyStr = process.env.HEDERA_DER_TESTNET_PRIVATE_KEY;
  const tokenIdStr = process.env.TESTNET_SPARK_TOKEN_ID;

  if (!accountId || !privateKeyStr) {
    throw new Error(
      '❌ Missing required environment variables:\n' +
        '   - HEDERA_TESTNET_ACCOUNT_ID\n' +
        '   - HEDERA_DER_TESTNET_PRIVATE_KEY'
    );
  }

  if (!tokenIdStr) {
    throw new Error(
      '❌ TESTNET_SPARK_TOKEN_ID not found in .env\n' +
        '   Please create the SPARK token first: npm run create:spark'
    );
  }

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Deployer Account: ${accountId}`);
  console.log(`   SPARK Token ID: ${tokenIdStr}\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    console.log('⏳ Reading contract bytecode...');

    // Read the compiled contract bytecode
    const contractBytecode = readContractBytecode();

    console.log('⏳ Deploying SPARKController contract...');

    // Convert token ID to Solidity address format
    // Hedera token IDs (0.0.xxxxx) need to be converted to EVM addresses
    const tokenAddress = tokenIdToAddress(tokenIdStr);

    // Derive owner address from private key (for signature verification)
    // On Hedera, we need to use the EVM address derived from the private key
    const hexPrivateKey = '0x' + privateKey.toStringRaw();
    const wallet = new ethers.Wallet(hexPrivateKey);
    const ownerAddress = wallet.address;

    console.log(`   Token Address (EVM format): ${tokenAddress}`);
    console.log(`   Owner Address (from private key): ${ownerAddress}`);

    // Deploy the contract with constructor parameters
    const contractCreateTx = await new ContractCreateFlow()
      .setGas(3000000) // 3M gas for contract deployment (SPARKController is a large contract)
      .setBytecode(contractBytecode)
      .setConstructorParameters(
        new ContractFunctionParameters().addAddress(tokenAddress).addAddress(ownerAddress)
      )
      .execute(client);

    const contractCreateRx = await contractCreateTx.getReceipt(client);

    const contractId = contractCreateRx.contractId;

    if (!contractId) {
      throw new Error('Contract ID not found in receipt');
    }

    console.log('\n✅ SPARKController deployed successfully!');
    console.log(`\n📊 Contract Details:`);
    console.log(`   Contract ID: ${contractId.toString()}`);
    console.log(`   Contract Address (EVM): ${contractId.toSolidityAddress()}`);
    console.log(`   Deployer: ${accountId}`);
    console.log(`   Network: ${network}`);
    console.log(`   SPARK Token: ${tokenIdStr}`);

    console.log(`\n🔗 View on HashScan:`);
    console.log(
      `   ${
        network === 'mainnet'
          ? `https://hashscan.io/mainnet/contract/${contractId.toString()}`
          : `https://hashscan.io/testnet/contract/${contractId.toString()}`
      }`
    );

    // Update .env file with contract address
    console.log('\n💾 Updating .env file with TESTNET_SPARK_CONTROLLER_ADDRESS...');

    const envPath = join(process.cwd(), '.env');
    let envContent = readFileSync(envPath, 'utf-8');

    const contractAddress = contractId.toEvmAddress();

    // Update or add TESTNET_SPARK_CONTROLLER_ADDRESS
    if (envContent.includes('TESTNET_SPARK_CONTROLLER_ADDRESS=')) {
      envContent = envContent.replace(
        /TESTNET_SPARK_CONTROLLER_ADDRESS='[^']*'/,
        `TESTNET_SPARK_CONTROLLER_ADDRESS='${contractAddress}'`
      );
    } else {
      envContent += `\nTESTNET_SPARK_CONTROLLER_ADDRESS='${contractAddress}'\n`;
    }

    writeFileSync(envPath, envContent);
    console.log('✅ .env file updated successfully');

    console.log('\n🎯 Next Steps:');
    console.log('   1. Associate SPARK token with contract: npm run associate:token');
    console.log('   2. Verify contract functionality');
    console.log('   3. Start recording production: npm run mint:spark');

    console.log('\n⚠️  Important Notes:');
    console.log('   - The contract owner is the deployer account');
    console.log('   - Only the owner can mint, burn, and record production');
    console.log('   - Keep your private keys secure');
  } catch (error) {
    console.error('\n❌ Error deploying contract:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INSUFFICIENT_TX_FEE')) {
        console.error('\n💡 Solution: Your account needs more HBAR.');
        console.error('   Request testnet HBAR from: https://portal.hedera.com/faucet');
      } else if (error.message.includes('INSUFFICIENT_GAS')) {
        console.error('\n💡 Solution: Increase gas limit in deployment script.');
      } else if (error.message.includes('bytecode')) {
        console.error('\n💡 Solution: Make sure to compile the contract first: npm run compile');
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    client.close();
  }
}

/**
 * Reads the compiled contract bytecode
 */
function readContractBytecode(): string {
  try {
    const artifactPath = join(
      process.cwd(),
      'artifacts',
      'contracts',
      'SPARKController.sol',
      'SPARKController.json'
    );

    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));

    if (!artifact.bytecode) {
      throw new Error('Bytecode not found in artifact. Please compile the contract first.');
    }

    return artifact.bytecode;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error('Contract artifact not found. Please compile first: npm run compile');
    }
    throw error;
  }
}

/**
 * Converts Hedera token ID to Solidity address format
 * @param tokenId Token ID in format "0.0.xxxxx"
 * @returns EVM-compatible address (20 bytes = 40 hex characters)
 */
function tokenIdToAddress(tokenId: string): string {
  // Hedera token IDs need to be converted to EVM addresses
  // Format: 0x + shard (4 bytes) + realm (8 bytes) + num (8 bytes) = 20 bytes total

  const parts = tokenId.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid token ID format: ${tokenId}. Expected format: 0.0.xxxxx`);
  }

  const shard = parseInt(parts[0]);
  const realm = parseInt(parts[1]);
  const num = parseInt(parts[2]);

  if (isNaN(shard) || isNaN(realm) || isNaN(num)) {
    throw new Error(`Invalid token ID: ${tokenId}`);
  }

  // Convert each part to hex with proper padding
  // Shard: 4 bytes = 8 hex characters
  // Realm: 8 bytes = 16 hex characters
  // Num: 8 bytes = 16 hex characters
  const shardHex = shard.toString(16).padStart(8, '0');
  const realmHex = realm.toString(16).padStart(16, '0');
  const numHex = num.toString(16).padStart(16, '0');

  // Construct EVM address (total 40 hex chars)
  const address = `0x${shardHex}${realmHex}${numHex}`;

  return address;
}

/**
 * Converts Hedera account ID to Solidity address format
 * @param accountId Account ID in format "0.0.xxxxx"
 * @returns EVM-compatible address (20 bytes = 40 hex characters)
 */
function accountIdToAddress(accountId: string): string {
  const parts = accountId.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid account ID format: ${accountId}. Expected format: 0.0.xxxxx`);
  }

  const shard = parseInt(parts[0]);
  const realm = parseInt(parts[1]);
  const num = parseInt(parts[2]);

  if (isNaN(shard) || isNaN(realm) || isNaN(num)) {
    throw new Error(`Invalid account ID: ${accountId}`);
  }

  const shardHex = shard.toString(16).padStart(8, '0');
  const realmHex = realm.toString(16).padStart(16, '0');
  const numHex = num.toString(16).padStart(16, '0');

  return `0x${shardHex}${realmHex}${numHex}`;
}

// Run the script
deploySPARKController().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
