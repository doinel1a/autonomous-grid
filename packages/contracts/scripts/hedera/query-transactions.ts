import 'dotenv/config';

import {
  Client,
  ContractCallQuery,
  ContractFunctionParameters,
  ContractId,
  PrivateKey
} from '@hashgraph/sdk';

/**
 * Queries transaction history from SPARKController
 *
 * Usage:
 *   npm run query:transactions
 *
 * Environment variables (optional):
 *   QUERY_USER_ADDRESS - The user address to query (defaults to all transactions)
 *   QUERY_LIMIT - Number of transactions to display (default: 10)
 */
async function queryTransactions() {
  console.log('📜 Querying Transaction History...\n');

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

  // Get query parameters
  const userAddress =
    process.env.QUERY_USER_ADDRESS ?? '0xd7b4967Edbc170774345b4a84F2E2c2CD3a3f102';
  const limit = parseInt(process.env.QUERY_LIMIT || '10');

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  if (userAddress) {
    console.log(`   Querying User: ${userAddress}`);
  } else {
    console.log(`   Querying: All transactions`);
  }
  console.log(`   Limit: ${limit}\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    const contractId = ContractId.fromSolidityAddress(controllerAddress);

    if (userAddress) {
      // Query transactions for specific user
      let evmUserAddress: string;
      if (userAddress.includes('.')) {
        evmUserAddress = accountIdToAddress(userAddress);
        console.log(`   User EVM Address: ${evmUserAddress}\n`);
      } else {
        evmUserAddress = userAddress;
      }

      // Query user transaction count
      console.log('⏳ Querying user transaction count...');
      const userTxCountQuery = new ContractCallQuery()
        .setContractId(contractId)
        .setGas(100000)
        .setFunction(
          'getUserTransactionsCount',
          new ContractFunctionParameters().addAddress(evmUserAddress)
        );

      const userTxCountResult = await userTxCountQuery.execute(client);
      const userTxCount = userTxCountResult.getUint256(0);

      console.log(`   User has ${userTxCount.toString()} transactions\n`);

      if (userTxCount.toString() === '0') {
        console.log('💡 No transactions found for this user.');
        console.log('   - Transfer energy: npm run transfer:energy');
        console.log('   - Produce energy: npm run mint:spark');
        return;
      }

      console.log('⏳ Fetching transaction details...\n');

      // Query virtual balance to show context
      const balanceQuery = new ContractCallQuery()
        .setContractId(contractId)
        .setGas(100000)
        .setFunction(
          'getVirtualBalanceInWh',
          new ContractFunctionParameters().addAddress(evmUserAddress)
        );

      const balanceResult = await balanceQuery.execute(client);
      const balanceWh = balanceResult.getUint256(0);

      // Display summary
      console.log('='.repeat(60));
      console.log('📊 Transaction Summary');
      console.log('='.repeat(60));
      console.log(`User: ${userAddress}`);
      console.log('-'.repeat(60));
      console.log(`Total Transactions:   ${userTxCount.toString()}`);
      console.log(`Current Balance:      ${balanceWh.toString()} Wh`);
      console.log('='.repeat(60));

      console.log('\n💡 Transaction Details:');
      console.log('   To view individual transaction details with seller/buyer/amount:');
      console.log('   1. Visit the contract on HashScan (link below)');
      console.log('   2. Go to the "Contract" tab → "Events" section');
      console.log('   3. Filter by event type "EnergyTransferred"');
      console.log(
        `   4. Filter by user address: ${evmUserAddress.toLowerCase()}`
      );
      console.log('\n   Each event shows:');
      console.log('     • Seller address');
      console.log('     • Buyer address');
      console.log('     • Amount transferred (in smallest units)');
      console.log('     • Timestamp');
      console.log('     • Transaction ID');
    } else {
      // Query global transactions
      console.log('⏳ Querying total transaction count...');
      const globalTxCountQuery = new ContractCallQuery()
        .setContractId(contractId)
        .setGas(100000)
        .setFunction('getTotalTransactionsCount');

      const globalTxCountResult = await globalTxCountQuery.execute(client);
      const globalTxCount = globalTxCountResult.getUint256(0);

      console.log(`   Total transactions: ${globalTxCount.toString()}\n`);

      if (globalTxCount.toString() === '0') {
        console.log('💡 No transactions found in the system.');
        console.log('   - Transfer energy: npm run transfer:energy');
        console.log('   - Produce energy: npm run mint:spark');
        return;
      }

      // Display summary
      console.log('='.repeat(60));
      console.log('📊 Global Transaction Summary');
      console.log('='.repeat(60));
      console.log(`Total Transactions: ${globalTxCount.toString()}`);
      console.log('='.repeat(60));

      console.log('\n💡 Transaction Details:');
      console.log('   To view all transaction details:');
      console.log('   1. Visit the contract on HashScan (link below)');
      console.log('   2. Go to the "Contract" tab → "Events" section');
      console.log('   3. Filter by event type "EnergyTransferred"');
      console.log('\n   Each event shows:');
      console.log('     • Seller address');
      console.log('     • Buyer address');
      console.log('     • Amount transferred (in smallest units)');
      console.log('     • Timestamp');
      console.log('     • Transaction ID');
    }

    console.log(`\n🔗 View Contract on HashScan:`);
    console.log(
      `   ${
        network === 'mainnet'
          ? `https://hashscan.io/mainnet/contract/${controllerAddress}`
          : `https://hashscan.io/testnet/contract/${controllerAddress}`
      }`
    );

    console.log('\n🎯 Available Actions:');
    console.log('   - Check balance: npm run query:balance');
    console.log('   - Transfer energy: npm run transfer:energy');
    console.log('   - Consume energy: npm run consume:energy');
  } catch (error) {
    console.error('\n❌ Error querying transactions:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INVALID_CONTRACT_ID')) {
        console.error('\n💡 Solution: Check TESTNET_SPARK_CONTROLLER_ADDRESS in .env');
      } else if (error.message.includes('CONTRACT_REVERT')) {
        console.error('\n💡 Possible reasons:');
        console.error('   - Invalid user address format');
        console.error('   - Contract not properly deployed');
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
queryTransactions().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
