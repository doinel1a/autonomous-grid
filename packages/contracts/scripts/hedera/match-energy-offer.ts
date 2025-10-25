import 'dotenv/config';

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  Hbar,
  PrivateKey
} from '@hashgraph/sdk';

/**
 * Matches an energy offer (fully or partially)
 *
 * Usage:
 *   OFFER_ID=0 BUYER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=500 npm run match:offer
 *
 * Note: Only the contract owner (VPP AI agent) can match offers
 * If match amount < offer amount, a new offer is created with the remaining amount
 */
async function matchEnergyOffer() {
  console.log('🤝 Matching energy offer...\n');

  // Validate environment variables
  const network = process.env.HEDERA_NETWORK || 'testnet';
  const accountId = process.env.HEDERA_TESTNET_ACCOUNT_ID;
  const privateKeyStr = process.env.HEDERA_DER_TESTNET_PRIVATE_KEY;
  const controllerAddress = process.env.TESTNET_SPARK_CONTROLLER_ADDRESS;

  if (!accountId || !privateKeyStr) {
    throw new Error(
      '❌ Missing required environment variables:\n' +
        '   - HEDERA_TESTNET_ACCOUNT_ID\n' +
        '   - HEDERA_DER_TESTNET_PRIVATE_KEY'
    );
  }

  if (!controllerAddress) {
    throw new Error(
      '❌ Missing SPARK configuration in .env:\n' +
        '   - TESTNET_SPARK_CONTROLLER_ADDRESS (run: npm run deploy:controller:testnet)'
    );
  }

  // Get parameters from environment
  const offerId = process.env.OFFER_ID ? parseInt(process.env.OFFER_ID) : null;
  const buyerAddress = process.env.BUYER_ADDRESS || null;
  const matchAmountWh = process.env.MATCH_AMOUNT_WH ? parseInt(process.env.MATCH_AMOUNT_WH) : null;

  if (offerId === null || !buyerAddress || matchAmountWh === null) {
    throw new Error(
      '❌ Missing required environment variables:\n' +
        '   Usage: OFFER_ID=0 BUYER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=500 npm run match:offer\n' +
        '   Run: npm run query:offers (to see available offers)'
    );
  }

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  console.log(`   Owner: ${accountId}`);
  console.log(`   Offer ID: ${offerId}`);
  console.log(`   Buyer: ${buyerAddress}`);
  console.log(`   Match Amount: ${matchAmountWh} Wh (${matchAmountWh / 1000} kWh)\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    // Convert buyer address to EVM format if needed
    let evmBuyerAddress: string;
    if (buyerAddress.includes('.')) {
      evmBuyerAddress = accountIdToAddress(buyerAddress);
      console.log(`   Buyer EVM Address: ${evmBuyerAddress}\n`);
    } else {
      evmBuyerAddress = buyerAddress;
    }

    console.log('⏳ Matching energy offer...');

    // Call matchEnergyOffer function
    const contractExecTx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(controllerAddress))
      .setGas(2000000) // 2M gas (might create new offer if partial match)
      .setFunction(
        'matchEnergyOffer',
        new ContractFunctionParameters()
          .addUint256(offerId)
          .addAddress(evmBuyerAddress)
          .addUint256(matchAmountWh)
      )
      .setMaxTransactionFee(new Hbar(10))
      .execute(client);

    console.log('⏳ Waiting for consensus...');

    const receipt = await contractExecTx.getReceipt(client);

    console.log('\n✅ Energy offer matched successfully!');
    console.log(`\n📊 Transaction Details:`);
    console.log(`   Transaction ID: ${contractExecTx.transactionId.toString()}`);
    console.log(`   Status: ${receipt.status.toString()}`);
    console.log(`   Offer ID: ${offerId}`);
    console.log(`   Buyer: ${buyerAddress}`);
    console.log(`   Matched Amount: ${matchAmountWh} Wh (${matchAmountWh / 1000} kWh)`);

    console.log(`\n🔗 View on HashScan:`);
    console.log(
      `   ${
        network === 'mainnet'
          ? `https://hashscan.io/mainnet/transaction/${contractExecTx.transactionId.toString()}`
          : `https://hashscan.io/testnet/transaction/${contractExecTx.transactionId.toString()}`
      }`
    );

    console.log('\n💡 Note:');
    console.log(
      '   - If partial match, a new offer was created with the remaining amount'
    );
    console.log('   - Energy was transferred from seller to buyer');
    console.log('   - Transaction record was created for audit trail');

    console.log('\n🎯 Next Steps:');
    console.log('   - Query offers: npm run query:offers');
    console.log('   - Query transactions: npm run query:transactions');
    console.log('   - Query buyer balance: npm run query:balance');
  } catch (error) {
    console.error('\n❌ Error matching energy offer:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INSUFFICIENT_GAS')) {
        console.error('\n💡 Solution: The transaction ran out of gas. Increase gas limit.');
      } else if (error.message.includes('INSUFFICIENT_TX_FEE')) {
        console.error('\n💡 Solution: Your account needs more HBAR.');
      } else if (error.message.includes('CONTRACT_REVERT')) {
        console.error('\n💡 Possible reasons:');
        console.error('   - Invalid offer ID (does not exist)');
        console.error('   - Offer is not ACTIVE (already cancelled/completed)');
        console.error('   - Match amount > offer amount');
        console.error('   - Invalid buyer address (zero address)');
        console.error('   - You are not the contract owner');
        console.error('   - Run: npm run query:offers (to see active offers)');
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
  const shardHex = shard.toString(16).padStart(8, '0');
  const realmHex = realm.toString(16).padStart(16, '0');
  const numHex = num.toString(16).padStart(16, '0');

  return `0x${shardHex}${realmHex}${numHex}`;
}

// Run the script
matchEnergyOffer().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
