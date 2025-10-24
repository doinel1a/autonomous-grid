import 'dotenv/config';

import {
  Client,
  ContractCallQuery,
  ContractFunctionParameters,
  ContractId,
  PrivateKey
} from '@hashgraph/sdk';

/**
 * Queries EUR/USD price from Pyth oracle via SPARKController
 *
 * Usage:
 *   npm run query:eur-usd-price
 *
 * The script queries three different price methods:
 * 1. getEurUsdPrice() - Basic price (unsafe)
 * 2. getEurUsdPriceWithConfidence() - Price with confidence interval
 * 3. getEurUsdPriceNoOlderThan(300) - Price no older than 5 minutes
 */
async function queryEurUsdPrice() {
  console.log('💱 Querying EUR/USD Price from Pyth Oracle...\n');

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

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    const contractId = ContractId.fromSolidityAddress(controllerAddress);

    // Query 1: Basic EUR/USD price (unsafe - no staleness check)
    console.log('⏳ Querying basic EUR/USD price...');
    const priceQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction('getEurUsdPrice');

    const priceResult = await priceQuery.execute(client);
    const price = priceResult.getInt64(0);
    const expo = priceResult.getInt32(1);
    const publishTime = priceResult.getUint256(2);

    // Query 2: EUR/USD price with confidence interval
    console.log('⏳ Querying EUR/USD price with confidence...');
    const priceWithConfQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction('getEurUsdPriceWithConfidence');

    const priceWithConfResult = await priceWithConfQuery.execute(client);
    const priceConf = priceWithConfResult.getInt64(0);
    const conf = priceWithConfResult.getUint64(1);
    const expoConf = priceWithConfResult.getInt32(2);
    const publishTimeConf = priceWithConfResult.getUint256(3);

    // Query 3: EUR/USD price no older than 5 minutes (300 seconds)
    console.log('⏳ Querying EUR/USD price (max 5 min old)...');
    let priceRecent: number = 0;
    let expoRecent = 0;
    let publishTimeRecent: number = 0;
    let recentPriceAvailable = true;

    try {
      const priceRecentQuery = new ContractCallQuery()
        .setContractId(contractId)
        .setGas(100000)
        .setFunction(
          'getEurUsdPriceNoOlderThan',
          new ContractFunctionParameters().addUint256(300)
        ); // 300 seconds = 5 minutes

      const priceRecentResult = await priceRecentQuery.execute(client);
      priceRecent = priceRecentResult.getInt64(0).toNumber();
      expoRecent = priceRecentResult.getInt32(1);
      publishTimeRecent = priceRecentResult.getUint256(2).toNumber();
    } catch (error) {
      recentPriceAvailable = false;
      console.log('   ⚠️  Recent price check failed (price may be stale)');
    }

    // Calculate actual prices
    const actualPrice = calculatePrice(price.toNumber(), expo);
    const actualPriceConf = calculatePrice(priceConf.toNumber(), expoConf);
    const confidenceValue = calculatePrice(conf.toNumber(), expoConf);

    // Display results
    console.log('\n' + '='.repeat(70));
    console.log('💱 EUR/USD Price Feed (via Pyth Network)');
    console.log('='.repeat(70));

    console.log('\n📊 Basic Price (Unsafe):');
    console.log('-'.repeat(70));
    console.log(`   Raw Price:        ${price.toString()}`);
    console.log(`   Exponent:         ${expo}`);
    console.log(`   Actual Price:     ${actualPrice.toFixed(8)} USD per EUR`);
    console.log(`   Publish Time:     ${new Date(publishTime.toNumber() * 1000).toISOString()}`);
    console.log(`   Age:              ${getAge(publishTime.toNumber())} seconds ago`);

    console.log('\n📈 Price with Confidence:');
    console.log('-'.repeat(70));
    console.log(`   Price:            ${actualPriceConf.toFixed(8)} USD per EUR`);
    console.log(`   Confidence:       ±${confidenceValue.toFixed(8)}`);
    console.log(`   Price Range:      ${(actualPriceConf - confidenceValue).toFixed(8)} - ${(actualPriceConf + confidenceValue).toFixed(8)} USD`);
    console.log(`   Publish Time:     ${new Date(publishTimeConf.toNumber() * 1000).toISOString()}`);

    if (recentPriceAvailable) {
      const actualPriceRecent = calculatePrice(priceRecent, expoRecent);
      console.log('\n✅ Recent Price (Max 5 min old):');
      console.log('-'.repeat(70));
      console.log(`   Price:            ${actualPriceRecent.toFixed(8)} USD per EUR`);
      console.log(`   Publish Time:     ${new Date(publishTimeRecent * 1000).toISOString()}`);
      console.log(`   Age:              ${getAge(publishTimeRecent)} seconds`);
    } else {
      console.log('\n❌ Recent Price Check:');
      console.log('-'.repeat(70));
      console.log('   Price is older than 5 minutes (staleness check failed)');
    }

    console.log('\n' + '='.repeat(70));

    // Price interpretation guide
    console.log('\n📖 How to Interpret:');
    console.log(`   - 1 EUR = ${actualPrice.toFixed(4)} USD`);
    console.log(`   - Confidence interval: ±${(confidenceValue * 100 / actualPrice).toFixed(2)}%`);

    const age = getAge(publishTime.toNumber());
    if (age > 60) {
      console.log('\n⚠️  Warning: Price is older than 1 minute');
      console.log('   Consider using getEurUsdPriceNoOlderThan() for critical operations');
    } else {
      console.log('\n✅ Price is fresh (less than 1 minute old)');
    }

    console.log(`\n🔗 View on Pyth Network:`);
    console.log(`   https://pyth.network/price-feeds/fx-eur-usd`);

    console.log(`\n🔗 View Contract on HashScan:`);
    console.log(
      `   ${
        network === 'mainnet'
          ? `https://hashscan.io/mainnet/contract/${controllerAddress}`
          : `https://hashscan.io/testnet/contract/${controllerAddress}`
      }`
    );

    console.log('\n📝 Price Feed Details:');
    console.log(`   Feed ID: 0xa995d00d27c4d2f5045a803288bd4e656e72a5d9f023591a9378de25d298c30b`);
    console.log(`   Asset: EUR/USD (Euro / US Dollar)`);
    console.log(`   Source: Pyth Network`);
    console.log(`   Publishers: 31+ data providers`);
  } catch (error) {
    console.error('\n❌ Error querying EUR/USD price:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INVALID_CONTRACT_ID')) {
        console.error('\n💡 Solution: Check TESTNET_SPARK_CONTROLLER_ADDRESS in .env');
      } else if (error.message.includes('CONTRACT_REVERT')) {
        console.error('\n💡 Possible reasons:');
        console.error('   - Pyth oracle not properly configured');
        console.error('   - Price feed ID incorrect');
        console.error('   - Network connection issues');
      } else if (error.message.includes('INSUFFICIENT_GAS')) {
        console.error('\n💡 Solution: Contract call requires more gas');
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
 * Calculates the actual price from raw price and exponent
 * @param rawPrice The raw price value from Pyth
 * @param exponent The exponent (usually negative)
 * @returns The actual price as a number
 */
function calculatePrice(rawPrice: number, exponent: number): number {
  return rawPrice * Math.pow(10, exponent);
}

/**
 * Calculates the age of a price in seconds
 * @param publishTime Unix timestamp in seconds
 * @returns Age in seconds
 */
function getAge(publishTime: number): number {
  const now = Math.floor(Date.now() / 1000);
  return now - publishTime;
}

// Run the script
queryEurUsdPrice().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
