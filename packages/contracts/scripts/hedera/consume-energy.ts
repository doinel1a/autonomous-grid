import 'dotenv/config';

import {
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  Hbar,
  PrivateKey
} from '@hashgraph/sdk';

/**
 * Consumes energy and burns corresponding SPARK tokens
 *
 * Usage:
 *   npm run consume:energy
 *
 * Environment variables (optional):
 *   CONSUMER_ADDRESS - The consumer address (defaults to operator account)
 *   CONSUME_AMOUNT_WH - Amount to consume in Wh
 */
async function consumeEnergy() {
  console.log('🔥 Consuming Energy and Burning Tokens...\n');

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
      '❌ TESTNET_SPARK_CONTROLLER_ADDRESS not found in .env\n' +
        '   Please deploy the contract first: npm run deploy:controller:testnet'
    );
  }

  // Get consume parameters
  const consumerAddress =
    process.env.CONSUMER_ADDRESS || '0xd7b4967Edbc170774345b4a84F2E2c2CD3a3f102';
  const whAmount = parseInt(process.env.CONSUME_AMOUNT_WH || '50');

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  console.log(`   Consumer: ${consumerAddress}`);
  console.log(`   Amount: ${whAmount} Wh\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    // Convert address to EVM format
    let evmConsumerAddress: string;
    if (consumerAddress.includes('.')) {
      evmConsumerAddress = accountIdToAddress(consumerAddress);
      console.log(`   Consumer EVM Address: ${evmConsumerAddress}\n`);
    } else {
      evmConsumerAddress = consumerAddress;
    }

    console.log('⏳ Consuming energy and burning tokens...');

    // Convert Wh to smallest units (multiply by 10^8)
    const sparkAmount = whAmount * 10 ** 8;

    // Call consumeEnergy function
    const contractExecTx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(controllerAddress))
      .setGas(1000000)
      .setFunction(
        'consumeEnergy',
        new ContractFunctionParameters().addAddress(evmConsumerAddress).addUint256(sparkAmount)
      )
      .setMaxTransactionFee(new Hbar(5))
      .execute(client);

    console.log('⏳ Waiting for consensus...');

    const receipt = await contractExecTx.getReceipt(client);

    console.log('\n✅ Energy consumed and tokens burned successfully!');
    console.log(`\n📊 Transaction Details:`);
    console.log(`   Transaction ID: ${contractExecTx.transactionId.toString()}`);
    console.log(`   Status: ${receipt.status.toString()}`);
    console.log(`   Consumer: ${consumerAddress}`);
    console.log(`   Amount Consumed: ${whAmount} Wh`);
    console.log(`   Tokens Burned: ${whAmount} SPARK`);

    console.log(`\n🔗 View on HashScan:`);
    console.log(
      `   ${
        network === 'mainnet'
          ? `https://hashscan.io/mainnet/transaction/${contractExecTx.transactionId.toString()}`
          : `https://hashscan.io/testnet/transaction/${contractExecTx.transactionId.toString()}`
      }`
    );

    console.log('\n💡 What Happened:');
    console.log(`   1. Virtual balance reduced by ${whAmount} Wh`);
    console.log(`   2. ${whAmount} SPARK tokens burned from treasury`);
    console.log('   3. Total supply decreased');

    console.log('\n🎯 Next Steps:');
    console.log('   - Check balance: npm run query:balance');
    console.log('   - View transactions: npm run query:transactions');
    console.log('   - Query token info: npm run query:spark');
  } catch (error) {
    console.error('\n❌ Error consuming energy:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INSUFFICIENT_GAS')) {
        console.error('\n💡 Solution: The transaction ran out of gas. Increase gas limit.');
      } else if (error.message.includes('INSUFFICIENT_TX_FEE')) {
        console.error('\n💡 Solution: Your account needs more HBAR.');
      } else if (error.message.includes('CONTRACT_REVERT')) {
        console.error('\n💡 Possible reasons:');
        console.error('   - Consumer has insufficient virtual balance');
        console.error('   - Not contract owner');
        console.error('   - Invalid address format');
        console.error('   - Contract does not have supply key');
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

  const shardHex = shard.toString(16).padStart(8, '0');
  const realmHex = realm.toString(16).padStart(16, '0');
  const numHex = num.toString(16).padStart(16, '0');

  return `0x${shardHex}${realmHex}${numHex}`;
}

// Run the script
consumeEnergy().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
