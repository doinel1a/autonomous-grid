import 'dotenv/config';

import { Client, ContractCallQuery, ContractId, PrivateKey } from '@hashgraph/sdk';

async function queryGridPrice() {
  console.log('💶 Querying Grid Energy Price...\n');

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

  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    const contractId = ContractId.fromSolidityAddress(controllerAddress);

    console.log('⏳ Querying grid price in EUR...');
    const eurQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction('getGridEnergyPriceEUR');

    const eurResult = await eurQuery.execute(client);
    const priceEUR = eurResult.getUint256(0);
    const lastUpdate = eurResult.getUint256(1);

    console.log('⏳ Querying grid price in USD (real-time conversion)...');
    const usdQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(200000)
      .setFunction('getGridEnergyPriceUSD');

    const usdResult = await usdQuery.execute(client);
    const priceUSD = usdResult.getUint256(0);
    const eurUsdRate = usdResult.getInt64(1);
    const expo = usdResult.getInt32(2);
    const lastUpdateUSD = usdResult.getUint256(3);

    const priceEurDisplay = priceEUR.toNumber() / 10 ** 8;
    const priceUsdDisplay = priceUSD.toNumber() / 10 ** 8;
    const exchangeRate = eurUsdRate.toNumber() * Math.pow(10, expo);

    console.log('\n' + '='.repeat(70));
    console.log('💶 Grid Energy Price');
    console.log('='.repeat(70));

    console.log('\n📊 Price in EUR:');
    console.log('-'.repeat(70));
    console.log(`   Price:            ${priceEurDisplay.toFixed(8)} EUR/kWh`);
    console.log(`   Last Update:      ${lastUpdate.toNumber() === 0 ? 'Never' : new Date(lastUpdate.toNumber() * 1000).toISOString()}`);
    console.log(`   Age:              ${lastUpdate.toNumber() === 0 ? 'N/A' : `${Math.floor(Date.now() / 1000 - lastUpdate.toNumber())} seconds`}`);

    console.log('\n💵 Price in USD (Real-time Conversion):');
    console.log('-'.repeat(70));
    console.log(`   Price:            ${priceUsdDisplay.toFixed(8)} USD/kWh`);
    console.log(`   EUR/USD Rate:     ${exchangeRate.toFixed(8)}`);
    console.log(`   Rate Exponent:    ${expo}`);

    console.log('\n' + '='.repeat(70));

    if (lastUpdate.toNumber() === 0) {
      console.log('\n⚠️  Grid price not set yet.');
      console.log('   Set price: npm run set:grid-price <price_in_eur>');
      console.log('   Example: npm run set:grid-price 0.25');
    } else {
      console.log('\n📖 Interpretation:');
      console.log(`   - Grid energy costs ${priceEurDisplay.toFixed(4)} EUR per kWh`);
      console.log(`   - At current exchange rate: ${priceUsdDisplay.toFixed(4)} USD per kWh`);
      console.log(`   - 1 EUR = ${exchangeRate.toFixed(4)} USD`);
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
    console.log('   - Update price: npm run set:grid-price <new_price>');
    console.log('   - View EUR/USD rate: npm run query:eur-usd-price');
  } catch (error) {
    console.error('\n❌ Error querying grid price:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INVALID_CONTRACT_ID')) {
        console.error('\n💡 Solution: Check TESTNET_SPARK_CONTROLLER_ADDRESS in .env');
      } else if (error.message.includes('CONTRACT_REVERT')) {
        console.error('\n💡 Possible reasons:');
        console.error('   - Contract not properly deployed');
        console.error('   - Pyth oracle issue (for USD conversion)');
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    client.close();
  }
}

queryGridPrice().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
