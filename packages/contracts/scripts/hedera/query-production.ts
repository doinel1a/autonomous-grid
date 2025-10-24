import 'dotenv/config';

import {
  Client,
  ContractCallQuery,
  ContractFunctionParameters,
  ContractId,
  PrivateKey
} from '@hashgraph/sdk';

/**
 * Queries production data from SPARKController
 *
 * Usage:
 *   npm run query:production
 *
 * Environment variables (optional):
 *   QUERY_PRODUCER_ADDRESS - The producer address to query (defaults to operator account)
 */
async function queryProduction() {
  console.log('🔍 Querying SPARK Production Data...\n');

  // Validate environment variables
  const network = process.env.HEDERA_NETWORK;
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
  const producerAddress = process.env.QUERY_PRODUCER_ADDRESS || accountId.toString();

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  console.log(`   Querying Producer: ${producerAddress}\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    // Convert producer address to proper format
    let evmProducerAddress: string;
    if (producerAddress.includes('.')) {
      evmProducerAddress = accountIdToAddress(producerAddress);
      console.log(`   Producer EVM Address: ${evmProducerAddress}\n`);
    } else {
      evmProducerAddress = producerAddress;
    }

    const contractId = ContractId.fromSolidityAddress(controllerAddress);

    // Query total production
    console.log('⏳ Querying total production...');
    const totalProductionQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction(
        'getTotalProduction',
        new ContractFunctionParameters().addAddress(evmProducerAddress)
      );

    const totalProductionResult = await totalProductionQuery.execute(client);
    const totalProduction = totalProductionResult.getUint256(0);

    console.log('⏳ Querying total production in kWh...');
    const totalProductionKwhQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction(
        'getTotalProductionInKwh',
        new ContractFunctionParameters().addAddress(evmProducerAddress)
      );

    const totalProductionKwhResult = await totalProductionKwhQuery.execute(client);
    const totalProductionKwh = totalProductionKwhResult.getUint256(0);

    // Query record count
    console.log('⏳ Querying record count...');
    const recordCountQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction(
        'getUserRecordsCount',
        new ContractFunctionParameters().addAddress(evmProducerAddress)
      );

    const recordCountResult = await recordCountQuery.execute(client);
    const recordCount = recordCountResult.getUint256(0);

    // Query global record count
    console.log('⏳ Querying global record count...');
    const globalRecordCountQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction('getTotalRecordsCount');

    const globalRecordCountResult = await globalRecordCountQuery.execute(client);
    const globalRecordCount = globalRecordCountResult.getUint256(0);

    // Display results
    console.log('\n' + '='.repeat(60));
    console.log('📊 SPARK Production Summary');
    console.log('='.repeat(60));
    console.log(`Producer: ${producerAddress}`);
    console.log('-'.repeat(60));
    console.log(`Total Production:     ${totalProduction.toString()} SPARK`);
    console.log(`                      ${totalProductionKwh.toString()} kWh`);
    console.log(`Production Records:   ${recordCount.toString()}`);
    console.log(`Global Records:       ${globalRecordCount.toString()}`);
    console.log('='.repeat(60));

    if (recordCount.toString() === '0') {
      console.log('\n💡 No production records found for this producer.');
      console.log('   Create your first record: npm run mint:spark');
    } else {
      console.log('\n⚡ Energy Economics:');
      console.log(`   1000 SPARK = 1 kWh`);
      console.log(
        `   This producer has generated ${totalProductionKwh.toString()} kWh of solar energy`
      );

      // Query a sample of recent records (paginated)
      console.log('\n📋 Recent Production Records (first 5):');
      try {
        const recentRecordsQuery = new ContractCallQuery()
          .setContractId(contractId)
          .setGas(200000)
          .setFunction(
            'getProductionRecordsPaginated',
            new ContractFunctionParameters()
              .addAddress(evmProducerAddress)
              .addUint256(0) // offset
              .addUint256(5) // limit
          );

        const recentRecordsResult = await recentRecordsQuery.execute(client);

        // Note: Parsing complex return types (arrays of structs) from ContractCallQuery
        // may require additional processing. This is a simplified version.
        console.log('   (Record details require additional parsing - check contract directly)');
      } catch (error) {
        console.log('   (Unable to fetch detailed records)');
      }
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
    console.log('   - Mint more tokens: npm run mint:spark');
    console.log('   - Burn tokens: npm run burn:spark');
    console.log('   - Query token info: npm run query:spark');
  } catch (error) {
    console.error('\n❌ Error querying production:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INVALID_CONTRACT_ID')) {
        console.error('\n💡 Solution: Check TESTNET_SPARK_CONTROLLER_ADDRESS in .env');
      } else if (error.message.includes('CONTRACT_REVERT')) {
        console.error('\n💡 Possible reasons:');
        console.error('   - Invalid producer address format');
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
queryProduction().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
