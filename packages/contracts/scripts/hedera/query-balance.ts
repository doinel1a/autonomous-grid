import 'dotenv/config';

import {
  Client,
  ContractCallQuery,
  ContractFunctionParameters,
  ContractId,
  PrivateKey
} from '@hashgraph/sdk';

/**
 * Queries virtual balance from SPARKController
 *
 * Usage:
 *   npm run query:balance
 *
 * Environment variables (optional):
 *   QUERY_USER_ADDRESS - The user address to query (defaults to operator account)
 */
async function queryBalance() {
  console.log('💰 Querying Virtual Balance...\n');

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
    process.env.QUERY_USER_ADDRESS || '0xd7b4967Edbc170774345b4a84F2E2c2CD3a3f102';

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  console.log(`   Querying User: ${userAddress}\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    // Convert user address to proper format
    let evmUserAddress: string;
    if (userAddress.includes('.')) {
      evmUserAddress = accountIdToAddress(userAddress);
      console.log(`   User EVM Address: ${evmUserAddress}\n`);
    } else {
      evmUserAddress = userAddress;
    }

    const contractId = ContractId.fromSolidityAddress(controllerAddress);

    // Query virtual balance (smallest units)
    console.log('⏳ Querying virtual balance...');
    const balanceQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction(
        'getVirtualBalance',
        new ContractFunctionParameters().addAddress(evmUserAddress)
      );

    const balanceResult = await balanceQuery.execute(client);
    const balance = balanceResult.getUint256(0);

    // Query virtual balance in Wh
    console.log('⏳ Querying balance in Wh...');
    const balanceWhQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction(
        'getVirtualBalanceInWh',
        new ContractFunctionParameters().addAddress(evmUserAddress)
      );

    const balanceWhResult = await balanceWhQuery.execute(client);
    const balanceWh = balanceWhResult.getUint256(0);

    // Query virtual balance in kWh
    console.log('⏳ Querying balance in kWh...');
    const balanceKwhQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction(
        'getVirtualBalanceInKwh',
        new ContractFunctionParameters().addAddress(evmUserAddress)
      );

    const balanceKwhResult = await balanceKwhQuery.execute(client);
    const balanceKwh = balanceKwhResult.getUint256(0);

    // Query transaction count
    console.log('⏳ Querying transaction count...');
    const txCountQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction(
        'getUserTransactionsCount',
        new ContractFunctionParameters().addAddress(evmUserAddress)
      );

    const txCountResult = await txCountQuery.execute(client);
    const txCount = txCountResult.getUint256(0);

    // Display results
    console.log('\n' + '='.repeat(60));
    console.log('💰 Virtual Balance Summary');
    console.log('='.repeat(60));
    console.log(`User: ${userAddress}`);
    console.log('-'.repeat(60));
    console.log(`Virtual Balance:      ${balance.toString()} (smallest units)`);
    console.log(`                      ${balanceWh.toString()} Wh`);
    console.log(`                      ${balanceKwh.toString()} kWh`);
    console.log(`Transaction Count:    ${txCount.toString()}`);
    console.log('='.repeat(60));

    if (balanceWh.toString() === '0') {
      console.log('\n💡 Balance is zero.');
      console.log('   - Produce energy: npm run mint:spark');
      console.log('   - Receive transfer: npm run transfer:energy');
    } else {
      console.log('\n⚡ Energy Available:');
      console.log(
        `   You have ${balanceWh.toString()} Wh (${balanceKwh.toString()} kWh) of energy credits`
      );
      console.log('   These credits can be transferred to others or consumed');
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
    console.log('   - Transfer energy: npm run transfer:energy');
    console.log('   - Consume energy: npm run consume:energy');
    console.log('   - View transactions: npm run query:transactions');
    console.log('   - Produce more: npm run mint:spark');
  } catch (error) {
    console.error('\n❌ Error querying balance:');
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
queryBalance().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
