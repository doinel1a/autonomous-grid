import 'dotenv/config';

import { AccountBalanceQuery, Client, PrivateKey, TokenId, TokenInfoQuery } from '@hashgraph/sdk';

/**
 * Queries and displays SPARK token information from Hedera
 */
async function querySparkInfo() {
  console.log('🔍 Querying SPARK Token Information...\n');

  // Validate environment variables
  const network = process.env.HEDERA_NETWORK;
  const accountId = process.env.HEDERA_TESTNET_ACCOUNT_ID;
  const privateKeyStr = process.env.HEDERA_DER_TESTNET_PRIVATE_KEY;
  const tokenIdStr = process.env.TESTNET_SPARK_TOKEN_ID;

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

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    const tokenId = TokenId.fromString(tokenIdStr);

    console.log('⏳ Fetching token information...\n');

    // Query token info
    const tokenInfo = await new TokenInfoQuery().setTokenId(tokenId).execute(client);

    // Query treasury balance
    const treasuryBalance = await new AccountBalanceQuery().setAccountId(accountId).execute(client);

    const sparkBalance = treasuryBalance.tokens?.get(tokenId);

    // Display token information
    console.log('📊 SPARK Token Information:');
    console.log('─'.repeat(60));
    console.log(`Token ID:           ${tokenInfo.tokenId.toString()}`);
    console.log(`Name:               ${tokenInfo.name}`);
    console.log(`Symbol:             ${tokenInfo.symbol}`);
    console.log(`Decimals:           ${tokenInfo.decimals}`);
    console.log(
      `Total Supply:       ${formatTokenAmount(tokenInfo.totalSupply.toString(), tokenInfo.decimals)} SPRK`
    );
    console.log(`Supply Type:        ${tokenInfo.supplyType === 0 ? 'INFINITE' : 'FINITE'}`);
    console.log(`Treasury Account:   ${tokenInfo.treasuryAccountId?.toString()}`);
    console.log(`Admin Key:          ${tokenInfo.adminKey ? '✓ Set' : '✗ Not Set'}`);
    console.log(`Supply Key:         ${tokenInfo.supplyKey ? '✓ Set' : '✗ Not Set'}`);
    console.log(`KYC Key:            ${tokenInfo.kycKey ? '✓ Set' : '✗ Not Set'}`);
    console.log(`Freeze Key:         ${tokenInfo.freezeKey ? '✓ Set' : '✗ Not Set'}`);
    console.log(`Wipe Key:           ${tokenInfo.wipeKey ? '✓ Set' : '✗ Not Set'}`);
    console.log(`Pause Key:          ${tokenInfo.pauseKey ? '✓ Set' : '✗ Not Set'}`);
    console.log('─'.repeat(60));

    console.log('\n💰 Treasury Balance:');
    console.log('─'.repeat(60));
    console.log(`HBAR Balance:       ${treasuryBalance.hbars.toString()}`);
    console.log(
      `SPARK Balance:      ${sparkBalance ? formatTokenAmount(sparkBalance.toString(), tokenInfo.decimals) : '0'} SPRK`
    );

    if (sparkBalance) {
      // Convert from smallest units to whole tokens, then to kWh
      const sparkWholeTokens = Number(sparkBalance) / 10 ** tokenInfo.decimals;
      const kWh = sparkWholeTokens / 1000;
      console.log(`Energy Equivalent:  ${kWh.toFixed(3)} kWh`);
    }
    console.log('─'.repeat(60));

    console.log(`\n🔗 View on HashScan:`);
    console.log(
      `   ${
        network === 'mainnet'
          ? `https://hashscan.io/mainnet/token/${tokenId.toString()}`
          : `https://hashscan.io/testnet/token/${tokenId.toString()}`
      }`
    );

    // Energy economics reminder
    console.log('\n⚡ Energy Economics:');
    console.log('   1000 SPARK = 1 kWh of solar energy');
    // Convert total supply from smallest units to whole tokens, then to kWh
    const totalSparkTokens = Number(tokenInfo.totalSupply) / 10 ** tokenInfo.decimals;
    const totalKwh = totalSparkTokens / 1000;
    console.log(`   Current supply represents: ${totalKwh.toFixed(3)} kWh`);
  } catch (error) {
    console.error('\n❌ Error querying token information:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INVALID_TOKEN_ID')) {
        console.error('\n💡 Solution: Check that TESTNET_SPARK_TOKEN_ID is correct in .env');
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
 * Format token amount with decimals
 */
function formatTokenAmount(amount: string, decimals: number): string {
  const num = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const integerPart = num / divisor;
  const fractionalPart = num % divisor;

  if (fractionalPart === BigInt(0)) {
    return integerPart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  // Remove trailing zeros
  const trimmedFractional = fractionalStr.replace(/0+$/, '');

  return `${integerPart}.${trimmedFractional}`;
}

// Run the script
querySparkInfo().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
