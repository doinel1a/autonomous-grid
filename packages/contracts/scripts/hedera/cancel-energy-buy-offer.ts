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
 * Cancels an active energy buy offer
 *
 * Usage:
 *   BUY_OFFER_ID=0 npm run cancel:buy-offer
 *
 * Note: Only the buyer or contract owner can cancel a buy offer
 */
async function cancelEnergyBuyOffer() {
  console.log('🚫 Cancelling energy buy offer...\n');

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

  // Get offer ID from environment
  const offerId = process.env.BUY_OFFER_ID ? parseInt(process.env.BUY_OFFER_ID) : null;

  if (offerId === null) {
    throw new Error(
      '❌ Missing BUY_OFFER_ID environment variable.\n' +
        '   Usage: BUY_OFFER_ID=0 npm run cancel:buy-offer\n' +
        '   Run: npm run query:buy-offers (to see available buy offers)'
    );
  }

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  console.log(`   Caller: ${accountId}`);
  console.log(`   Buy Offer ID: ${offerId}\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    console.log('⏳ Cancelling energy buy offer...');

    // Call cancelEnergyBuyOffer function
    const contractExecTx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(controllerAddress))
      .setGas(500000) // 500k gas
      .setFunction('cancelEnergyBuyOffer', new ContractFunctionParameters().addUint256(offerId))
      .setMaxTransactionFee(new Hbar(5))
      .execute(client);

    console.log('⏳ Waiting for consensus...');

    const receipt = await contractExecTx.getReceipt(client);

    console.log('\n✅ Energy buy offer cancelled successfully!');
    console.log(`\n📊 Transaction Details:`);
    console.log(`   Transaction ID: ${contractExecTx.transactionId.toString()}`);
    console.log(`   Status: ${receipt.status.toString()}`);
    console.log(`   Buy Offer ID: ${offerId}`);
    console.log(`   Caller: ${accountId}`);

    console.log(`\n🔗 View on HashScan:`);
    console.log(
      `   ${
        network === 'mainnet'
          ? `https://hashscan.io/mainnet/transaction/${contractExecTx.transactionId.toString()}`
          : `https://hashscan.io/testnet/transaction/${contractExecTx.transactionId.toString()}`
      }`
    );

    console.log('\n🎯 Next Steps:');
    console.log('   - Query buy offers: npm run query:buy-offers');
    console.log('   - Create new buy offer: npm run create:buy-offer');
  } catch (error) {
    console.error('\n❌ Error cancelling energy buy offer:');
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
        console.error('   - You are not the buyer or contract owner');
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

// Run the script
cancelEnergyBuyOffer().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
