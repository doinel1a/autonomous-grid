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
 * Matches an energy buy offer with a seller (fully or partially)
 *
 * Usage:
 *   BUY_OFFER_ID=0 SELLER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=500 npm run match:buy-offer
 *
 * Note: Only the contract owner (VPP AI) can match buy offers
 * If match amount < buy offer amount, a new buy offer is created with the remaining amount
 */
async function matchEnergyBuyOffer() {
  console.log('🤝 Matching energy buy offer...\n');

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
  const offerId = process.env.BUY_OFFER_ID ? parseInt(process.env.BUY_OFFER_ID) : null;
  const sellerAddress = process.env.SELLER_ADDRESS || null;
  const matchAmountWh = process.env.MATCH_AMOUNT_WH ? parseInt(process.env.MATCH_AMOUNT_WH) : null;

  if (offerId === null || !sellerAddress || matchAmountWh === null) {
    throw new Error(
      '❌ Missing required environment variables:\n' +
        '   Usage: BUY_OFFER_ID=0 SELLER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=500 npm run match:buy-offer\n' +
        '   Run: npm run query:buy-offers (to see available buy offers)'
    );
  }

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  console.log(`   Owner: ${accountId}`);
  console.log(`   Buy Offer ID: ${offerId}`);
  console.log(`   Seller: ${sellerAddress}`);
  console.log(`   Match Amount: ${matchAmountWh} Wh (${matchAmountWh / 1000} kWh)\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    // Convert seller address to EVM format if needed
    let evmSellerAddress: string;
    if (sellerAddress.includes('.')) {
      evmSellerAddress = accountIdToAddress(sellerAddress);
      console.log(`   Seller EVM Address: ${evmSellerAddress}\n`);
    } else {
      evmSellerAddress = sellerAddress;
    }

    console.log('⏳ Matching energy buy offer...');

    // Call matchEnergyBuyOffer function
    const contractExecTx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(controllerAddress))
      .setGas(2000000) // 2M gas (might create new offer if partial match)
      .setFunction(
        'matchEnergyBuyOffer',
        new ContractFunctionParameters()
          .addUint256(offerId)
          .addAddress(evmSellerAddress)
          .addUint256(matchAmountWh)
      )
      .setMaxTransactionFee(new Hbar(10))
      .execute(client);

    console.log('⏳ Waiting for consensus...');

    const receipt = await contractExecTx.getReceipt(client);

    console.log('\n✅ Energy buy offer matched successfully!');
    console.log(`\n📊 Transaction Details:`);
    console.log(`   Transaction ID: ${contractExecTx.transactionId.toString()}`);
    console.log(`   Status: ${receipt.status.toString()}`);
    console.log(`   Buy Offer ID: ${offerId}`);
    console.log(`   Seller: ${sellerAddress}`);
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
      '   - If partial match, a new buy offer was created with the remaining amount'
    );
    console.log('   - Energy was transferred from seller to buyer');
    console.log('   - Transaction record was created for audit trail');

    console.log('\n🎯 Next Steps:');
    console.log('   - Query buy offers: npm run query:buy-offers');
    console.log('   - Query transactions: npm run query:transactions');
    console.log('   - Query buyer balance: npm run query:balance');
  } catch (error) {
    console.error('\n❌ Error matching energy buy offer:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INSUFFICIENT_GAS')) {
        console.error('\n💡 Solution: The transaction ran out of gas. Increase gas limit.');
      } else if (error.message.includes('INSUFFICIENT_TX_FEE')) {
        console.error('\n💡 Solution: Your account needs more HBAR.');
      } else if (error.message.includes('CONTRACT_REVERT')) {
        console.error('\n💡 Possible reasons:');
        console.error('   - Invalid buy offer ID (does not exist)');
        console.error('   - Buy offer is not ACTIVE (already cancelled/completed)');
        console.error('   - Match amount > buy offer amount');
        console.error('   - Invalid seller address (zero address)');
        console.error('   - Seller has insufficient available balance');
        console.error('   - You are not the contract owner');
        console.error('   - Run: npm run query:buy-offers (to see active buy offers)');
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
matchEnergyBuyOffer().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
