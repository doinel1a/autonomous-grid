import 'dotenv/config';

import {
  Client,
  ContractCallQuery,
  ContractFunctionParameters,
  ContractId,
  PrivateKey
} from '@hashgraph/sdk';

/**
 * Tests direct call to Pyth oracle contract
 * This helps debug if the issue is with Pyth integration
 */
async function testPythDirect() {
  console.log('🔍 Testing Direct Pyth Oracle Call...\n');

  const network = process.env.HEDERA_NETWORK || 'testnet';
  const accountId = process.env.HEDERA_TESTNET_ACCOUNT_ID;
  const privateKeyStr = process.env.HEDERA_DER_TESTNET_PRIVATE_KEY;
  const pythOracleAddress = process.env.TESTNET_PYTH_PRICE_READER_ADDRESS;

  if (!accountId || !privateKeyStr || !pythOracleAddress) {
    throw new Error('Missing required environment variables');
  }

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Pyth Oracle: ${pythOracleAddress}\n`);

  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    const contractId = ContractId.fromSolidityAddress(pythOracleAddress);
    const eurUsdFeedId = '0xa995d00d27c4d2f5045a803288bd4e656e72a5d9f023591a9378de25d298c30b';

    console.log('⏳ Calling getPriceUnsafe() on Pyth contract...');
    console.log(`   Feed ID: ${eurUsdFeedId}\n`);

    const query = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(500000)
      .setFunction('getPriceUnsafe', new ContractFunctionParameters().addBytes32(Buffer.from(eurUsdFeedId.slice(2), 'hex')));

    const result = await query.execute(client);

    console.log('✅ Success! Pyth contract responded.\n');
    console.log('📊 Raw Response:');
    console.log(`   Price: ${result.getInt64(0)}`);
    console.log(`   Conf: ${result.getUint64(1)}`);
    console.log(`   Expo: ${result.getInt32(2)}`);
    console.log(`   PublishTime: ${result.getUint256(3)}`);
  } catch (error) {
    console.error('\n❌ Error calling Pyth contract:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  } finally {
    client.close();
  }
}

testPythDirect().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
