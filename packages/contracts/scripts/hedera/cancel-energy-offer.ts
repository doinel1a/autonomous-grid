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

import { signCancelOffer } from './utils/signature.js';

/**
 * Cancels an active energy offer
 *
 * Usage:
 *   OFFER_ID=0 npm run cancel:offer
 *
 * Note: Admin can cancel any active sell offer
 */
async function cancelEnergyOffer() {
  console.log('🚫 Cancelling energy offer...\n');

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

  // Get private key for signing
  const privateKeyHex = process.env.HEDERA_TESTNET_HEX_PRIVATE_KEY;
  if (!privateKeyHex) {
    throw new Error('❌ Missing HEDERA_TESTNET_HEX_PRIVATE_KEY in .env');
  }

  // Get offer ID from environment
  const offerId = process.env.OFFER_ID ? parseInt(process.env.OFFER_ID) : null;

  if (offerId === null) {
    throw new Error(
      '❌ Missing OFFER_ID environment variable.\n' +
        '   Usage: OFFER_ID=0 npm run cancel:offer\n' +
        '   Run: npm run query:offers (to see available offers)'
    );
  }

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  console.log(`   Offer ID: ${offerId}\n`);

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

    // Generate signature
    const signature = await signCancelOffer(
      offerId,
      deadline,
      controllerAddress,
      chainId,
      privateKeyHex
    );

    console.log(
      `   Signature: ${signature.substring(0, 10)}...${signature.substring(signature.length - 10)}`
    );
    console.log(`   Deadline: ${new Date(deadline * 1000).toISOString()}`);

    console.log('\n⏳ Cancelling energy offer...');

    // Call cancelEnergyOffer function with signature
    const contractExecTx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(controllerAddress))
      .setGas(2000000) // 2M gas for signature verification
      .setFunction(
        'cancelEnergyOffer',
        new ContractFunctionParameters()
          .addUint256(offerId)
          .addUint256(deadline)
          .addBytes(ethers.getBytes(signature))
      )
      .setMaxTransactionFee(new Hbar(10))
      .execute(client);

    console.log('⏳ Waiting for consensus...');

    const receipt = await contractExecTx.getReceipt(client);

    console.log('\n✅ Energy offer cancelled successfully!');
    console.log(`\n📊 Transaction Details:`);
    console.log(`   Transaction ID: ${contractExecTx.transactionId.toString()}`);
    console.log(`   Status: ${receipt.status.toString()}`);
    console.log(`   Offer ID: ${offerId}`);

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
    console.log('   - Create new offer: npm run create:offer');
  } catch (error) {
    console.error('\n❌ Error cancelling energy offer:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INSUFFICIENT_GAS')) {
        console.error('\n💡 Solution: The transaction ran out of gas. Increase gas limit.');
      } else if (error.message.includes('INSUFFICIENT_TX_FEE')) {
        console.error('\n💡 Solution: Your account needs more HBAR.');
      } else if (error.message.includes('CONTRACT_REVERT')) {
        console.error('\n💡 Possible reasons:');
        console.error('   - Invalid signature or expired deadline');
        console.error('   - Invalid offer ID (does not exist)');
        console.error('   - Offer is not ACTIVE (already cancelled/completed)');
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

// Run the script
cancelEnergyOffer().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
