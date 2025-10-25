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
import { ethers } from 'ethers';

import { signCreateOffer } from './utils/signature.js';

/**
 * Creates an energy offer for selling energy
 *
 * Usage:
 *   npm run create:offer
 *   Or set environment variables:
 *   SELLER_ADDRESS=0x... OFFER_AMOUNT_WH=1000 OFFER_PRICE_PER_KWH=15000000 npm run create:offer
 *
 * Note: Only registered producers (who have produced energy) can create offers
 * The seller address must have virtual balance from previous production
 */
async function createEnergyOffer() {
  console.log('💡 Creating energy offer...\n');

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

  // Get seller address (default to the one we used for minting)
  const privateKeyHex = process.env.HEDERA_TESTNET_HEX_PRIVATE_KEY;
  if (!privateKeyHex) {
    throw new Error('❌ Missing HEDERA_TESTNET_HEX_PRIVATE_KEY in .env');
  }

  // Get seller address from environment variable
  // This is the producer address that should have virtual balance
  const sellerAddress = process.env.SELLER_ADDRESS || '0xCd27a4898Bf3692dC5Dc2B6dF6fe59605eB5089e'; // Admin

  // Get parameters from environment or use defaults for testing
  const amountWh = process.env.OFFER_AMOUNT_WH ? parseInt(process.env.OFFER_AMOUNT_WH) : 500; // 500 Wh = 0.5 kWh
  const pricePerKwh = process.env.OFFER_PRICE_PER_KWH
    ? parseInt(process.env.OFFER_PRICE_PER_KWH)
    : 15000000; // 0.15 EUR/kWh with 8 decimals

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  console.log(`   Seller: ${sellerAddress}`);
  console.log(`   Amount: ${amountWh} Wh (${amountWh / 1000} kWh)`);
  console.log(`   Price: ${pricePerKwh / 100000000} EUR/kWh\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    console.log('⏳ Generating signature...');

    // Generate signature deadline (1 hour from now)
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Get chainId (296 for Hedera testnet, 295 for mainnet)
    const chainId = network === 'mainnet' ? 295 : 296;

    // Generate signature (includes contractAddress and chainId to prevent replay attacks)
    const signature = await signCreateOffer(
      sellerAddress,
      amountWh,
      pricePerKwh,
      deadline,
      controllerAddress,
      chainId,
      privateKeyHex
    );

    console.log(
      `   Signature: ${signature.substring(0, 10)}...${signature.substring(signature.length - 10)}`
    );
    console.log(`   Deadline: ${new Date(deadline * 1000).toISOString()}`);

    console.log('\n⏳ Creating energy offer...');

    // Call createEnergyOffer function with signature
    const contractExecTx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(controllerAddress))
      .setGas(2000000) // 2M gas for signature verification
      .setFunction(
        'createEnergyOffer',
        new ContractFunctionParameters()
          .addAddress(sellerAddress)
          .addUint256(amountWh)
          .addUint256(pricePerKwh)
          .addUint256(deadline)
          .addBytes(ethers.getBytes(signature))
      )
      .setMaxTransactionFee(new Hbar(10))
      .execute(client);

    console.log('⏳ Waiting for consensus...');

    const receipt = await contractExecTx.getReceipt(client);

    console.log('\n✅ Energy offer created successfully!');
    console.log(`\n📊 Transaction Details:`);
    console.log(`   Transaction ID: ${contractExecTx.transactionId.toString()}`);
    console.log(`   Status: ${receipt.status.toString()}`);
    console.log(`   Seller: ${sellerAddress}`);
    console.log(`   Amount: ${amountWh} Wh (${amountWh / 1000} kWh)`);
    console.log(`   Price: ${pricePerKwh / 100000000} EUR/kWh`);

    console.log(`\n🔗 View on HashScan:`);
    console.log(
      `   ${
        network === 'mainnet'
          ? `https://hashscan.io/mainnet/transaction/${contractExecTx.transactionId.toString()}`
          : `https://hashscan.io/testnet/transaction/${contractExecTx.transactionId.toString()}`
      }`
    );

    console.log('\n🎯 Next Steps:');
    console.log('   - Query offers: npm run query:offers');
    console.log('   - Match offer: npm run match:offer');
    console.log('   - Cancel offer: npm run cancel:offer');
  } catch (error) {
    console.error('\n❌ Error creating energy offer:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INSUFFICIENT_GAS')) {
        console.error('\n💡 Solution: The transaction ran out of gas. Increase gas limit.');
      } else if (error.message.includes('INSUFFICIENT_TX_FEE')) {
        console.error('\n💡 Solution: Your account needs more HBAR.');
      } else if (error.message.includes('CONTRACT_REVERT')) {
        console.error('\n💡 Possible reasons:');
        console.error('   - Invalid signature or expired deadline');
        console.error('   - Seller is not a registered producer (no energy production recorded)');
        console.error('   - Insufficient available balance (virtual - locked)');
        console.error('   - Invalid amount or price (must be > 0)');
        console.error('   - Run: npm run mint:spark (to register seller as producer)');
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
createEnergyOffer().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
