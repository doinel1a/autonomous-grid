import 'dotenv/config';

import { Client, ContractId, PrivateKey, TokenId, TokenUpdateTransaction } from '@hashgraph/sdk';

/**
 * Transfers the SPARK token supply key from treasury to the SPARKController contract
 *
 * Prerequisites:
 * - SPARK token must be created
 * - SPARKController must be deployed
 * - Token must be associated with contract (run: npm run associate:token)
 *
 * This operation:
 * - Changes the supply key from your account to the contract
 * - Enables the contract to mint/burn tokens autonomously
 * - Makes the contract the sole controller of token supply
 *
 * ⚠️ WARNING: This is irreversible! After this, only the contract can mint/burn tokens.
 */
async function transferSupplyKey() {
  console.log('🔑 Transferring SPARK token supply key to contract...\n');

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
  console.log(`   Controller Address: ${controllerAddress}`);
  console.log(`   Current Supply Key: Your Account (${accountId})`);
  console.log(`   New Supply Key: Contract (${controllerAddress})\n`);

  console.log('⚠️  WARNING:');
  console.log('   This operation is IRREVERSIBLE!');
  console.log('   After this, only the contract can mint/burn tokens.');
  console.log('   Make sure the contract is properly deployed and tested.\n');

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    console.log('⏳ Updating token supply key...');

    const tokenId = TokenId.fromString(tokenIdStr);
    const contractId = ContractId.fromSolidityAddress(controllerAddress);

    // Update token to set contract as supply key
    const tokenUpdateTx = await new TokenUpdateTransaction()
      .setTokenId(tokenId)
      .setSupplyKey(contractId) // Set contract as new supply key
      .freezeWith(client);

    // Sign with current admin key (your account)
    const tokenUpdateSign = await tokenUpdateTx.sign(privateKey);

    // Submit transaction
    const tokenUpdateSubmit = await tokenUpdateSign.execute(client);

    console.log('⏳ Waiting for consensus...');

    const receipt = await tokenUpdateSubmit.getReceipt(client);

    console.log('\n✅ Supply key transferred successfully!');
    console.log(`\n📊 Transaction Details:`);
    console.log(`   Transaction ID: ${tokenUpdateSubmit.transactionId.toString()}`);
    console.log(`   Status: ${receipt.status.toString()}`);
    console.log(`   Token ID: ${tokenIdStr}`);
    console.log(`   New Supply Key: Contract ${controllerAddress}`);

    console.log(`\n🔗 View on HashScan:`);
    console.log(
      `   ${
        network === 'mainnet'
          ? `https://hashscan.io/mainnet/transaction/${tokenUpdateSubmit.transactionId.toString()}`
          : `https://hashscan.io/testnet/transaction/${tokenUpdateSubmit.transactionId.toString()}`
      }`
    );

    console.log('\n🎯 Next Steps:');
    console.log('   1. Test minting: npm run mint:spark');
    console.log('   2. Query production: npm run query:production');
    console.log('   3. Test burning: npm run burn:spark');

    console.log('\n✅ Setup Complete!');
    console.log('   The contract now has full control over SPARK token supply.');
    console.log('   All mint/burn operations will go through the contract.');
  } catch (error) {
    console.error('\n❌ Error transferring supply key:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INSUFFICIENT_TX_FEE')) {
        console.error('\n💡 Solution: Your account needs more HBAR.');
        console.error('   Request testnet HBAR from: https://portal.hedera.com/faucet');
      } else if (error.message.includes('INVALID_SIGNATURE')) {
        console.error('\n💡 Solution: You need admin key permissions to update the token.');
      } else if (error.message.includes('TOKEN_IS_IMMUTABLE')) {
        console.error('\n💡 Solution: The token was created without admin key.');
        console.error('   You need to recreate the token with admin key enabled.');
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
transferSupplyKey().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
