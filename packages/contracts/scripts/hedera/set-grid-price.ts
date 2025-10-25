import 'dotenv/config';

import {
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  PrivateKey
} from '@hashgraph/sdk';

async function setGridPrice() {
  console.log('💶 Setting Grid Energy Price...\n');

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

  const priceEurPerKwh = process.argv[2] || process.env.GRID_PRICE_EUR_PER_KWH || '0.25';

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  console.log(`   Price: ${priceEurPerKwh} EUR/kWh\n`);

  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    const contractId = ContractId.fromSolidityAddress(controllerAddress);

    const priceInSmallestUnits = Math.floor(parseFloat(priceEurPerKwh) * 10 ** 8);

    console.log('⏳ Setting grid energy price...');
    console.log(`   Price (smallest units): ${priceInSmallestUnits}\n`);

    const tx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(500000)
      .setFunction('setGridEnergyPrice', new ContractFunctionParameters().addUint256(priceInSmallestUnits))
      .execute(client);

    const receipt = await tx.getReceipt(client);

    console.log('✅ Grid energy price set successfully!\n');
    console.log(`📊 Transaction Details:`);
    console.log(`   Transaction ID: ${tx.transactionId.toString()}`);
    console.log(`   Status: ${receipt.status.toString()}`);
    console.log(`   Price Set: ${priceEurPerKwh} EUR/kWh`);

    console.log(`\n🔗 View on HashScan:`);
    console.log(
      `   ${
        network === 'mainnet'
          ? `https://hashscan.io/mainnet/transaction/${tx.transactionId.toString()}`
          : `https://hashscan.io/testnet/transaction/${tx.transactionId.toString()}`
      }`
    );

    console.log('\n🎯 Next Steps:');
    console.log('   - Query grid price: npm run query:grid-price');
  } catch (error) {
    console.error('\n❌ Error setting grid price:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INVALID_CONTRACT_ID')) {
        console.error('\n💡 Solution: Check TESTNET_SPARK_CONTROLLER_ADDRESS in .env');
      } else if (error.message.includes('CONTRACT_REVERT')) {
        console.error('\n💡 Possible reasons:');
        console.error('   - Not contract owner');
        console.error('   - Invalid price (must be > 0)');
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    client.close();
  }
}

setGridPrice().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
