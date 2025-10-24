import { Client, PrivateKey, TokenId, TokenInfoQuery } from '@hashgraph/sdk';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Queries detailed token information including who holds the supply key
 */
async function querySupplyKey() {
  console.log('🔍 Querying SPARK token supply key details...\n');

  const network = process.env.HEDERA_NETWORK || 'testnet';
  const accountId = process.env.HEDERA_TESTNET_ACCOUNT_ID;
  const privateKeyStr = process.env.HEDERA_DER_TESTNET_PRIVATE_KEY;
  const tokenIdStr = process.env.TESTNET_SPARK_TOKEN_ID;
  const controllerAddress = process.env.TESTNET_SPARK_CONTROLLER_ADDRESS;

  if (!accountId || !privateKeyStr || !tokenIdStr || !controllerAddress) {
    throw new Error('Missing required environment variables');
  }

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Token ID: ${tokenIdStr}`);
  console.log(`   Contract Address: ${controllerAddress}`);
  console.log(`   User Account: ${accountId}\n`);

  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    const tokenId = TokenId.fromString(tokenIdStr);

    console.log('⏳ Fetching token information...\n');

    const tokenInfo = await new TokenInfoQuery().setTokenId(tokenId).execute(client);

    console.log('📊 Token Information:');
    console.log(`   Token ID: ${tokenInfo.tokenId.toString()}`);
    console.log(`   Name: ${tokenInfo.name}`);
    console.log(`   Symbol: ${tokenInfo.symbol}`);
    console.log(`   Decimals: ${tokenInfo.decimals}`);
    console.log(`   Total Supply: ${tokenInfo.totalSupply.toString()}`);
    console.log(`   Supply Type: ${tokenInfo.supplyType}`);
    console.log(`   Max Supply: ${tokenInfo.maxSupply?.toString() || 'N/A'}`);
    console.log(`   Treasury Account: ${tokenInfo.treasuryAccountId?.toString()}`);

    console.log('\n🔑 Key Information:');
    console.log(`   Admin Key: ${tokenInfo.adminKey ? '✓ Set' : '✗ Not set'}`);
    console.log(`   Supply Key: ${tokenInfo.supplyKey ? '✓ Set' : '✗ Not set'}`);

    if (tokenInfo.supplyKey) {
      const supplyKeyStr = tokenInfo.supplyKey.toString();
      console.log(`   Supply Key Details: ${supplyKeyStr}`);

      // Convert contract EVM address to Hedera ID for comparison
      const contractNum = parseInt(controllerAddress.slice(2), 16); // Remove 0x and parse hex
      const expectedContractId = `0.0.${contractNum}`;

      // Check if supply key matches the expected contract
      if (supplyKeyStr === expectedContractId) {
        console.log('\n🎉 SUCCESS! Supply key is held by SPARKController contract!');
        console.log(`   Contract ID: ${expectedContractId}`);
        console.log(`   Contract Address: ${controllerAddress}`);

        console.log('\n💡 Analysis:');
        console.log('   ✅ The contract can now mint and burn tokens!');
        console.log('   Next steps:');
        console.log('   - Test minting: pnpm mint:spark');
        console.log('   - Query production: pnpm query:production');
      } else {
        console.log('\n⚠️  Supply key is NOT held by the SPARKController contract');
        console.log(`   Current holder: ${supplyKeyStr}`);
        console.log(`   Expected contract: ${expectedContractId} (${controllerAddress})`);
        console.log('\n   You need to run: pnpm transfer:supply-key');

        console.log('\n💡 Analysis:');
        console.log('   ❌ Supply key needs to be transferred to the contract first.');
        console.log('   Run: pnpm transfer:supply-key');
      }
    }
  } catch (error) {
    console.error('\n❌ Error querying token:', error);
    throw error;
  } finally {
    client.close();
  }
}

querySupplyKey().catch(console.error);
