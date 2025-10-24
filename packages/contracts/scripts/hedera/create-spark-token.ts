import 'dotenv/config';

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import {
  Client,
  Hbar,
  PrivateKey,
  TokenCreateTransaction,
  TokenSupplyType,
  TokenType
} from '@hashgraph/sdk';

/**
 * Creates the SPARK token on Hedera Token Service (HTS)
 *
 * Token specifications:
 * - Name: SPARK
 * - Symbol: SPRK
 * - Decimals: 8 (limited by uint64 in HTS mintToken function)
 * - Initial Supply: 0
 * - Max Supply: Unlimited (dynamic supply)
 * - Economics: 1000 SPARK = 1 kWh of solar energy
 */
async function createSparkToken() {
  console.log('🚀 Creating SPARK Token on Hedera...\n');

  // Validate environment variables
  const network = process.env.HEDERA_NETWORK;
  const accountId = process.env.HEDERA_TESTNET_ACCOUNT_ID;
  const privateKeyStr = process.env.HEDERA_DER_TESTNET_PRIVATE_KEY;

  if (!accountId || !privateKeyStr) {
    throw new Error(
      '❌ Missing required environment variables:\n' +
        '   - HEDERA_TESTNET_ACCOUNT_ID\n' +
        '   - HEDERA_DER_TESTNET_PRIVATE_KEY\n\n' +
        'Please configure these in your .env file.'
    );
  }

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Treasury Account: ${accountId}`);
  console.log(`   Token Name: SPARK`);
  console.log(`   Token Symbol: SPRK`);
  console.log(`   Decimals: 8 (due to uint64 limit in HTS)`);
  console.log(`   Initial Supply: 0`);
  console.log(`   Supply Type: INFINITE (dynamic mint/burn)\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    console.log('⏳ Creating token transaction...');

    // Create the SPARK token
    const tokenCreateTx = new TokenCreateTransaction()
      .setTokenName('SPARK')
      .setTokenSymbol('SPRK')
      .setDecimals(8) // 8 decimals (like USDC) - necessary due to uint64 limit in HTS mintToken
      .setInitialSupply(0) // Start with 0 supply
      .setTreasuryAccountId(accountId)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite) // Unlimited supply for dynamic minting
      .setAdminKey(privateKey.publicKey) // Admin key for token management
      .setSupplyKey(privateKey.publicKey) // Supply key for mint/burn operations
      .setMaxTransactionFee(new Hbar(30)) // Set max fee to prevent unexpected costs
      .freezeWith(client);

    // Sign with the treasury account private key
    const tokenCreateSign = await tokenCreateTx.sign(privateKey);

    // Submit the transaction to the Hedera network
    const tokenCreateSubmit = await tokenCreateSign.execute(client);

    console.log('⏳ Waiting for consensus...');

    // Get the receipt of the transaction
    const tokenCreateRx = await tokenCreateSubmit.getReceipt(client);

    // Get the token ID from the receipt
    const tokenId = tokenCreateRx.tokenId;

    if (!tokenId) {
      throw new Error('Token ID not found in receipt');
    }

    console.log('\n✅ SPARK Token created successfully!');
    console.log(`\n📊 Token Details:`);
    console.log(`   Token ID: ${tokenId.toString()}`);
    console.log(`   Name: SPARK`);
    console.log(`   Symbol: SPRK`);
    console.log(`   Decimals: 8`);
    console.log(`   Treasury: ${accountId}`);
    console.log(`   Supply Type: INFINITE`);
    console.log(`   Initial Supply: 0`);
    console.log(`\n🔗 View on HashScan:`);
    console.log(
      `   ${
        network === 'mainnet'
          ? `https://hashscan.io/mainnet/token/${tokenId.toString()}`
          : `https://hashscan.io/testnet/token/${tokenId.toString()}`
      }`
    );

    // Update .env file with token ID
    console.log('\n💾 Updating .env file with TESTNET_SPARK_TOKEN_ID...');

    const envPath = join(process.cwd(), '.env');
    let envContent = readFileSync(envPath, 'utf-8');

    // Update or add TESTNET_SPARK_TOKEN_ID
    if (envContent.includes('TESTNET_SPARK_TOKEN_ID=')) {
      envContent = envContent.replace(
        /TESTNET_SPARK_TOKEN_ID='[^']*'/,
        `TESTNET_SPARK_TOKEN_ID='${tokenId.toString()}'`
      );
    } else {
      envContent += `\nTESTNET_SPARK_TOKEN_ID='${tokenId.toString()}'\n`;
    }

    writeFileSync(envPath, envContent);
    console.log('✅ .env file updated successfully');

    console.log('\n🎯 Next Steps:');
    console.log('   1. Deploy SPARKController contract: npm run deploy:controller:testnet');
    console.log('   2. Associate token with contract');
    console.log('   3. Start minting tokens: npm run mint:spark');
  } catch (error) {
    console.error('\n❌ Error creating SPARK token:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      // Provide helpful error messages
      if (error.message.includes('INSUFFICIENT_TX_FEE')) {
        console.error('\n💡 Solution: Your account needs more HBAR.');
        console.error('   Request testnet HBAR from: https://portal.hedera.com/faucet');
      } else if (error.message.includes('INVALID_SIGNATURE')) {
        console.error('\n💡 Solution: Check that your private key matches your account ID.');
      } else if (error.message.includes('INVALID_ACCOUNT_ID')) {
        console.error(
          '\n💡 Solution: Verify your HEDERA_TESTNET_ACCOUNT_ID format (e.g., 0.0.12345).'
        );
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
createSparkToken().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
