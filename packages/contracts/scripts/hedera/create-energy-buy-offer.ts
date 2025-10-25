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
 * Creates an energy buy offer
 *
 * Usage:
 *   npm run create:buy-offer
 *   Or set environment variables:
 *   BUY_OFFER_AMOUNT_WH=1000 BUY_OFFER_MAX_PRICE_PER_KWH=20000000 npm run create:buy-offer
 *
 * Note: Anyone can create buy offers (no registration required)
 */
async function createEnergyBuyOffer() {
  console.log('💰 Creating energy buy offer...\n');

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

  // Get parameters from environment or use defaults for testing
  const amountWh = process.env.BUY_OFFER_AMOUNT_WH ? parseInt(process.env.BUY_OFFER_AMOUNT_WH) : 1000; // 1000 Wh = 1 kWh
  const maxPricePerKwh = process.env.BUY_OFFER_MAX_PRICE_PER_KWH
    ? parseInt(process.env.BUY_OFFER_MAX_PRICE_PER_KWH)
    : 20000000; // 0.20 EUR/kWh with 8 decimals

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  console.log(`   Buyer: ${accountId}`);
  console.log(`   Amount: ${amountWh} Wh (${amountWh / 1000} kWh)`);
  console.log(`   Max Price: ${maxPricePerKwh / 100000000} EUR/kWh\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    console.log('⏳ Creating energy buy offer...');

    // Call createEnergyBuyOffer function
    const contractExecTx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(controllerAddress))
      .setGas(1000000) // 1M gas
      .setFunction(
        'createEnergyBuyOffer',
        new ContractFunctionParameters().addUint256(amountWh).addUint256(maxPricePerKwh)
      )
      .setMaxTransactionFee(new Hbar(5))
      .execute(client);

    console.log('⏳ Waiting for consensus...');

    const receipt = await contractExecTx.getReceipt(client);

    console.log('\n✅ Energy buy offer created successfully!');
    console.log(`\n📊 Transaction Details:`);
    console.log(`   Transaction ID: ${contractExecTx.transactionId.toString()}`);
    console.log(`   Status: ${receipt.status.toString()}`);
    console.log(`   Buyer: ${accountId}`);
    console.log(`   Amount: ${amountWh} Wh (${amountWh / 1000} kWh)`);
    console.log(`   Max Price: ${maxPricePerKwh / 100000000} EUR/kWh`);

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
    console.log('   - Match offer: npm run match:buy-offer');
    console.log('   - Cancel offer: npm run cancel:buy-offer');
  } catch (error) {
    console.error('\n❌ Error creating energy buy offer:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INSUFFICIENT_GAS')) {
        console.error('\n💡 Solution: The transaction ran out of gas. Increase gas limit.');
      } else if (error.message.includes('INSUFFICIENT_TX_FEE')) {
        console.error('\n💡 Solution: Your account needs more HBAR.');
      } else if (error.message.includes('CONTRACT_REVERT')) {
        console.error('\n💡 Possible reasons:');
        console.error('   - Invalid amount or price (must be > 0)');
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
createEnergyBuyOffer().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
