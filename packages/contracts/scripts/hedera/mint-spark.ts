import 'dotenv/config';

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  AccountBalanceQuery,
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  Hbar,
  PrivateKey,
  TokenId
} from '@hashgraph/sdk';
import { ethers } from 'ethers';

import { signRecordProduction } from './utils/signature.js';

/**
 * Records energy production and mints SPARK tokens
 *
 * Usage:
 *   npm run mint:spark
 *   Then follow the prompts or set environment variables
 *
 * Environment variables (optional):
 *   PRODUCER_ADDRESS - The producer's address
 *   KWH_AMOUNT - The kWh amount to mint
 *
 * Economics: 1000 SPARK = 1 kWh
 */
async function mintSpark() {
  console.log('⚡ Minting SPARK tokens and recording production...\n');

  // Validate environment variables
  const network = process.env.HEDERA_NETWORK || 'testnet';
  const accountId = process.env.HEDERA_TESTNET_ACCOUNT_ID;
  const privateKeyStr = process.env.HEDERA_DER_TESTNET_PRIVATE_KEY;
  const tokenIdStr = process.env.TESTNET_SPARK_TOKEN_ID;
  const controllerAddress = process.env.TESTNET_SPARK_CONTROLLER_ADDRESS;

  if (!accountId || !privateKeyStr) {
    throw new Error(
      '❌ Missing required environment variables:\n' +
        '   - HEDERA_TESTNET_ACCOUNT_ID\n' +
        '   - HEDERA_DER_TESTNET_PRIVATE_KEY'
    );
  }

  if (!tokenIdStr || !controllerAddress) {
    throw new Error(
      '❌ Missing SPARK configuration in .env:\n' +
        '   - TESTNET_SPARK_TOKEN_ID (run: npm run create:spark)\n' +
        '   - TESTNET_SPARK_CONTROLLER_ADDRESS (run: npm run deploy:controller:testnet)'
    );
  }

  // Get parameters from environment or use defaults for testing
  const producerAddress = process.env.PRODUCER_ADDRESS || accountId.toString();
  const kwhAmount = process.env.KWH_AMOUNT ? parseFloat(process.env.KWH_AMOUNT) : 10;

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  console.log(`   Producer: ${producerAddress}`);
  console.log(`   kWh Amount: ${kwhAmount} kWh`);
  console.log(`   SPARK Amount: ${kwhAmount * 1000} SPARK\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    // Get contract ABI
    const abi = getContractABI();

    // Convert producer address to proper format
    // If it's a Hedera account ID (0.0.xxxxx), convert to EVM address
    let evmProducerAddress: string;
    if (producerAddress.includes('.')) {
      evmProducerAddress = accountIdToAddress(producerAddress);
      console.log(`   Producer EVM Address: ${evmProducerAddress}\n`);
    } else {
      evmProducerAddress = producerAddress;
    }

    console.log('⏳ Generating signature...');

    // Generate signature deadline (1 hour from now)
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Get private key in hex format for signing
    const privateKeyHex = process.env.HEDERA_TESTNET_HEX_PRIVATE_KEY;

    // Generate signature
    const signature = await signRecordProduction(
      evmProducerAddress,
      Math.floor(kwhAmount),
      deadline,
      privateKeyHex
    );

    console.log(
      `   Signature: ${signature.substring(0, 10)}...${signature.substring(signature.length - 10)}`
    );
    console.log(`   Deadline: ${new Date(deadline * 1000).toISOString()}`);

    console.log('\n⏳ Recording production and minting tokens...');

    // Call recordProductionAndMint function with signature
    const contractExecTx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(controllerAddress))
      .setGas(2000000) // 2M gas for signature verification
      .setFunction(
        'recordProductionAndMint',
        new ContractFunctionParameters()
          .addAddress(evmProducerAddress)
          .addUint256(Math.floor(kwhAmount)) // kWh as integer
          .addUint256(deadline) // Signature deadline
          .addBytes(ethers.getBytes(signature)) // Signature bytes
      )
      .setMaxTransactionFee(new Hbar(10))
      .execute(client);

    console.log('⏳ Waiting for consensus...');

    const receipt = await contractExecTx.getReceipt(client);

    console.log('\n✅ Production recorded and tokens minted successfully!');
    console.log(`\n📊 Transaction Details:`);
    console.log(`   Transaction ID: ${contractExecTx.transactionId.toString()}`);
    console.log(`   Status: ${receipt.status.toString()}`);
    console.log(`   Producer: ${producerAddress}`);
    console.log(`   Energy Produced: ${kwhAmount} kWh`);
    console.log(`   SPARK Minted: ${kwhAmount * 1000} SPARK`);

    // Query token balance (if possible)
    try {
      console.log('\n💰 Querying token balance...');
      const tokenId = TokenId.fromString(tokenIdStr);
      const balance = await new AccountBalanceQuery().setAccountId(accountId).execute(client);

      const sparkBalance = balance.tokens?.get(tokenId);
      if (sparkBalance) {
        console.log(`   Treasury SPARK Balance: ${sparkBalance.toString()} SPARK`);
        console.log(`   Energy Equivalent: ${Number(sparkBalance) / 1000} kWh`);
      }
    } catch (balanceError) {
      console.log('   (Balance query skipped)');
    }

    console.log(`\n🔗 View on HashScan:`);
    console.log(
      `   ${
        network === 'mainnet'
          ? `https://hashscan.io/mainnet/transaction/${contractExecTx.transactionId.toString()}`
          : `https://hashscan.io/testnet/transaction/${contractExecTx.transactionId.toString()}`
      }`
    );

    console.log('\n🎯 Next Steps:');
    console.log('   - Query production: npm run query:production');
    console.log('   - Burn tokens: npm run burn:spark');
    console.log('   - Query token info: npm run query:spark');
  } catch (error) {
    console.error('\n❌ Error minting SPARK tokens:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INSUFFICIENT_GAS')) {
        console.error('\n💡 Solution: The transaction ran out of gas. Increase gas limit.');
      } else if (error.message.includes('INSUFFICIENT_TX_FEE')) {
        console.error('\n💡 Solution: Your account needs more HBAR.');
      } else if (error.message.includes('CONTRACT_REVERT')) {
        console.error('\n💡 Possible reasons:');
        console.error('   - Token not associated with contract');
        console.error('   - Invalid producer address format');
        console.error('   - Not contract owner');
      } else if (error.message.includes('INVALID_CONTRACT_ID')) {
        console.error('\n💡 Solution: Check TESTNET_SPARK_CONTROLLER_ADDRESS in .env');
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
 * Gets the contract ABI
 */
function getContractABI(): any {
  try {
    const artifactPath = join(
      process.cwd(),
      'artifacts',
      'contracts',
      'SPARKController.sol',
      'SPARKController.json'
    );

    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
    return artifact.abi;
  } catch (error) {
    throw new Error('Contract artifact not found. Please compile first: npm run compile');
  }
}

/**
 * Converts Hedera account ID to EVM address format
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

  // Convert each part to hex with proper padding
  // Shard: 4 bytes = 8 hex characters
  // Realm: 8 bytes = 16 hex characters
  // Num: 8 bytes = 16 hex characters
  const shardHex = shard.toString(16).padStart(8, '0');
  const realmHex = realm.toString(16).padStart(16, '0');
  const numHex = num.toString(16).padStart(16, '0');

  return `0x${shardHex}${realmHex}${numHex}`;
}

// Run the script
mintSpark().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
