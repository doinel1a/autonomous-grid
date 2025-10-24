import 'dotenv/config';

import { AccountBalanceQuery, Client, Hbar, PrivateKey, TransferTransaction } from '@hashgraph/sdk';

/**
 * Funds the SPARKController contract with HBAR for operations
 */
async function fundContract() {
  console.log('💰 Funding SPARKController contract with HBAR...\n');

  const network = process.env.HEDERA_NETWORK;
  const accountId = process.env.HEDERA_TESTNET_ACCOUNT_ID;
  const privateKeyStr = process.env.HEDERA_DER_TESTNET_PRIVATE_KEY;
  const controllerAddress = process.env.TESTNET_SPARK_CONTROLLER_ADDRESS;

  if (!accountId || !privateKeyStr || !controllerAddress) {
    throw new Error('Missing required environment variables');
  }

  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    // Convert contract EVM address to Hedera ID
    const contractNum = parseInt(controllerAddress.slice(2), 16);
    const contractId = `0.0.${contractNum}`;

    console.log(`   Contract ID: ${contractId}`);
    console.log(`   Contract Address: ${controllerAddress}\n`);

    // Check current contract balance
    console.log('⏳ Checking contract balance...');
    const contractBalance = await new AccountBalanceQuery()
      .setAccountId(contractId)
      .execute(client);

    console.log(`   Current Balance: ${contractBalance.hbars.toString()}\n`);

    // Transfer 10 HBAR to the contract
    const amount = new Hbar(10);
    console.log(`⏳ Transferring ${amount.toString()} to contract...`);

    const transferTx = await new TransferTransaction()
      .addHbarTransfer(accountId, amount.negated())
      .addHbarTransfer(contractId, amount)
      .execute(client);

    console.log('⏳ Waiting for consensus...');
    const receipt = await transferTx.getReceipt(client);

    console.log('\n✅ Contract funded successfully!');
    console.log(`\n📊 Transaction Details:`);
    console.log(`   Transaction ID: ${transferTx.transactionId.toString()}`);
    console.log(`   Status: ${receipt.status.toString()}`);
    console.log(`   Amount: ${amount.toString()}`);

    // Check new balance
    console.log('\n⏳ Checking new contract balance...');
    const newBalance = await new AccountBalanceQuery().setAccountId(contractId).execute(client);

    console.log(`   New Balance: ${newBalance.hbars.toString()}`);

    console.log('\n🎯 Next Step:');
    console.log('   Test minting: pnpm test:mint');
  } catch (error) {
    console.error('\n❌ Error funding contract:', error);
    throw error;
  } finally {
    client.close();
  }
}

fundContract().catch(console.error);
