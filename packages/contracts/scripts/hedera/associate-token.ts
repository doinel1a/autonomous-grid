import 'dotenv/config';

import { Client, ContractExecuteTransaction, ContractId, PrivateKey } from '@hashgraph/sdk';

/**
 * Associates the SPARK token with the SPARKController contract
 *
 * Prerequisites:
 * - SPARK token must be created
 * - SPARKController contract must be deployed
 * - TESTNET_SPARK_TOKEN_ID and TESTNET_SPARK_CONTROLLER_ADDRESS must be set in .env
 *
 * Token association is required on Hedera before a contract can hold tokens
 * This calls the associateToken() function on the SPARKController contract
 */
async function associateToken() {
  console.log('🔗 Associating SPARK token with SPARKController contract...\n');

  // Validate environment variables
  const network = process.env.HEDERA_NETWORK;
  const accountId = process.env.HEDERA_TESTNET_ACCOUNT_ID;
  const privateKeyStr = process.env.HEDERA_DER_TESTNET_PRIVATE_KEY;
  const tokenIdStr = process.env.TESTNET_SPARK_TOKEN_ID;
  const controllerAddress = process.env.TESTNET_SPARK_CONTROLLER_ADDRESS;

  if (!accountId || !privateKeyStr) {
    throw new Error(
      '❌ Missing required environment variables:\n' +
        '   - HEDERA_TESTNET_ACCOUNT_ID\n' +
        '   - HEDERA_DER_TESTNET_PRIVATE_KEY'
    );
  }

  if (!tokenIdStr) {
    throw new Error(
      '❌ TESTNET_SPARK_TOKEN_ID not found in .env\n' +
        '   Please create the token first: npm run create:spark'
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
  console.log(`   Token ID: ${tokenIdStr}`);
  console.log(`   Controller Address: ${controllerAddress}\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    console.log('⏳ Calling associateToken() on SPARKController...');

    const contractId = ContractId.fromSolidityAddress(controllerAddress);

    // Call the associateToken function on the contract
    const contractExecTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(500000) // 500k gas for association
      .setFunction('associateToken')
      .execute(client);

    console.log('⏳ Waiting for consensus...');

    const receipt = await contractExecTx.getReceipt(client);

    console.log('\n✅ Token associated with contract successfully!');
    console.log(`\n📊 Transaction Details:`);
    console.log(`   Transaction ID: ${contractExecTx.transactionId.toString()}`);
    console.log(`   Status: ${receipt.status.toString()}`);
    console.log(`   Token ID: ${tokenIdStr}`);
    console.log(`   Contract: ${controllerAddress}`);

    console.log(`\n🔗 View on HashScan:`);
    console.log(
      `   ${
        network === 'mainnet'
          ? `https://hashscan.io/mainnet/transaction/${contractExecTx.transactionId.toString()}`
          : `https://hashscan.io/testnet/transaction/${contractExecTx.transactionId.toString()}`
      }`
    );

    console.log('\n🎯 Next Steps:');
    console.log('   1. Transfer supply key to contract: npm run transfer:supply-key');
    console.log('   2. After transfer, test minting: npm run mint:spark');

    console.log('\n⚠️  Important:');
    console.log('   The contract is now associated with the token but cannot mint yet.');
    console.log('   You must transfer the supply key to the contract for it to mint/burn.');
  } catch (error) {
    console.error('\n❌ Error associating token:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INSUFFICIENT_GAS')) {
        console.error('\n💡 Solution: Increase gas limit in the script.');
      } else if (error.message.includes('INSUFFICIENT_TX_FEE')) {
        console.error('\n💡 Solution: Your account needs more HBAR.');
        console.error('   Request testnet HBAR from: https://portal.hedera.com/faucet');
      } else if (error.message.includes('CONTRACT_REVERT')) {
        console.error('\n💡 Possible reasons:');
        console.error('   - Not contract owner');
        console.error('   - Token already associated');
        console.error('   - Invalid token ID in contract');
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
associateToken().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
