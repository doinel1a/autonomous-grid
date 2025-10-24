import {
  AccountBalanceQuery,
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  Hbar,
  PrivateKey,
  TokenId
} from '@hashgraph/sdk';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Burns SPARK tokens
 *
 * Usage:
 *   npm run burn:spark
 *   Then follow the prompts or set environment variables
 *
 * Environment variables (optional):
 *   BURN_AMOUNT - The amount of SPARK tokens to burn
 *
 * Economics: 1000 SPARK = 1 kWh
 */
async function burnSpark() {
  console.log('🔥 Burning SPARK tokens...\n');

  // Validate environment variables
  const network = process.env.HEDERA_NETWORK || 'testnet';
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

  if (!tokenIdStr || !controllerAddress) {
    throw new Error(
      '❌ Missing SPARK configuration in .env:\n' +
        '   - TESTNET_SPARK_TOKEN_ID (run: npm run create:spark)\n' +
        '   - TESTNET_SPARK_CONTROLLER_ADDRESS (run: npm run deploy:controller:testnet)'
    );
  }

  // Get parameters from environment or use defaults for testing
  const burnAmount = process.env.BURN_AMOUNT ? parseInt(process.env.BURN_AMOUNT) : 1000;
  const kwhEquivalent = burnAmount / 1000;

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  console.log(`   Burn Amount: ${burnAmount} SPARK`);
  console.log(`   kWh Equivalent: ${kwhEquivalent} kWh\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    // Query balance before burn
    console.log('💰 Querying balance before burn...');
    const tokenId = TokenId.fromString(tokenIdStr);
    const balanceBefore = await new AccountBalanceQuery().setAccountId(accountId).execute(client);

    const sparkBalanceBefore = balanceBefore.tokens?.get(tokenId);
    if (sparkBalanceBefore) {
      console.log(`   Current Balance: ${sparkBalanceBefore.toString()} SPARK`);
      console.log(`   Energy Equivalent: ${Number(sparkBalanceBefore) / 1000} kWh`);
    } else {
      console.log('   Current Balance: 0 SPARK');
    }

    console.log('\n⏳ Burning tokens...');

    // Call burnTokens function
    const contractExecTx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(controllerAddress))
      .setGas(500000)
      .setFunction('burnTokens', new ContractFunctionParameters().addUint256(burnAmount))
      .setMaxTransactionFee(new Hbar(10))
      .execute(client);

    console.log('⏳ Waiting for consensus...');

    const receipt = await contractExecTx.getReceipt(client);

    console.log('\n✅ Tokens burned successfully!');
    console.log(`\n📊 Transaction Details:`);
    console.log(`   Transaction ID: ${contractExecTx.transactionId.toString()}`);
    console.log(`   Status: ${receipt.status.toString()}`);
    console.log(`   Burned Amount: ${burnAmount} SPARK`);
    console.log(`   Energy Equivalent: ${kwhEquivalent} kWh`);

    // Query balance after burn
    console.log('\n💰 Querying balance after burn...');
    const balanceAfter = await new AccountBalanceQuery().setAccountId(accountId).execute(client);

    const sparkBalanceAfter = balanceAfter.tokens?.get(tokenId);
    if (sparkBalanceAfter) {
      console.log(`   New Balance: ${sparkBalanceAfter.toString()} SPARK`);
      console.log(`   Energy Equivalent: ${Number(sparkBalanceAfter) / 1000} kWh`);

      if (sparkBalanceBefore) {
        const burned = Number(sparkBalanceBefore) - Number(sparkBalanceAfter);
        console.log(`   Difference: -${burned} SPARK`);
      }
    } else {
      console.log('   New Balance: 0 SPARK');
    }

    console.log(`\n🔗 View on HashScan:`);
    console.log(
      `   ${
        network === 'mainnet'
          ? `https://hashscan.io/mainnet/transaction/${contractExecTx.transactionId.toString()}`
          : `https://hashscan.io/testnet/transaction/${contractExecTx.transactionId.toString()}`
      }`
    );

    console.log('\n🎯 Next Steps:');
    console.log('   - Query token info: npm run query:spark');
    console.log('   - Mint more tokens: npm run mint:spark');
    console.log('   - Query production: npm run query:production');
  } catch (error) {
    console.error('\n❌ Error burning SPARK tokens:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INSUFFICIENT_GAS')) {
        console.error('\n💡 Solution: The transaction ran out of gas. Increase gas limit.');
      } else if (error.message.includes('INSUFFICIENT_TX_FEE')) {
        console.error('\n💡 Solution: Your account needs more HBAR.');
      } else if (error.message.includes('INSUFFICIENT_TOKEN_BALANCE')) {
        console.error('\n💡 Solution: Not enough SPARK tokens to burn.');
      } else if (error.message.includes('CONTRACT_REVERT')) {
        console.error('\n💡 Possible reasons:');
        console.error('   - Not contract owner');
        console.error('   - Invalid burn amount (zero or too large)');
        console.error('   - Token not associated with contract');
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
burnSpark().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
