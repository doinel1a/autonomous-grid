import 'dotenv/config';

import {
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  Hbar,
  PrivateKey
} from '@hashgraph/sdk';

/**
 * Transfers energy credits from seller to buyer
 *
 * Usage:
 *   npm run transfer:energy
 *
 * Environment variables (optional):
 *   SELLER_ADDRESS - The seller address (defaults to operator account)
 *   BUYER_ADDRESS - The buyer address (required)
 *   TRANSFER_AMOUNT_WH - Amount to transfer in Wh
 */
async function transferEnergy() {
  console.log('💸 Transferring Energy Credits...\n');

  // Validate environment variables
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

  // Get transfer parameters
  const sellerAddress = process.env.SELLER_ADDRESS || accountId.toString();
  const buyerAddress = process.env.BUYER_ADDRESS ?? '0xd7b4967Edbc170774345b4a84F2E2c2CD3a3f102';
  const whAmount = parseInt(process.env.TRANSFER_AMOUNT_WH || '100');

  if (!buyerAddress) {
    throw new Error(
      '❌ BUYER_ADDRESS is required in .env\n' + '   Example: BUYER_ADDRESS=0.0.123456'
    );
  }

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  console.log(`   Seller: ${sellerAddress}`);
  console.log(`   Buyer: ${buyerAddress}`);
  console.log(`   Amount: ${whAmount} Wh\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    // Convert addresses to EVM format
    let evmSellerAddress: string;
    if (sellerAddress.includes('.')) {
      evmSellerAddress = accountIdToAddress(sellerAddress);
      console.log(`   Seller EVM Address: ${evmSellerAddress}`);
    } else {
      evmSellerAddress = sellerAddress;
    }

    let evmBuyerAddress: string;
    if (buyerAddress.includes('.')) {
      evmBuyerAddress = accountIdToAddress(buyerAddress);
      console.log(`   Buyer EVM Address: ${evmBuyerAddress}`);
    } else {
      evmBuyerAddress = buyerAddress;
    }

    console.log('\n⏳ Transferring energy credits...');

    // Convert Wh to smallest units (multiply by 10^8)
    const sparkAmount = whAmount * 10 ** 8;

    // Call transferEnergy function
    const contractExecTx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(controllerAddress))
      .setGas(1000000)
      .setFunction(
        'transferEnergy',
        new ContractFunctionParameters()
          .addAddress(evmSellerAddress)
          .addAddress(evmBuyerAddress)
          .addUint256(sparkAmount)
      )
      .setMaxTransactionFee(new Hbar(5))
      .execute(client);

    console.log('⏳ Waiting for consensus...');

    const receipt = await contractExecTx.getReceipt(client);

    console.log('\n✅ Energy transferred successfully!');
    console.log(`\n📊 Transaction Details:`);
    console.log(`   Transaction ID: ${contractExecTx.transactionId.toString()}`);
    console.log(`   Status: ${receipt.status.toString()}`);
    console.log(`   Seller: ${sellerAddress}`);
    console.log(`   Buyer: ${buyerAddress}`);
    console.log(`   Amount: ${whAmount} Wh`);

    console.log(`\n🔗 View on HashScan:`);
    console.log(
      `   ${
        network === 'mainnet'
          ? `https://hashscan.io/mainnet/transaction/${contractExecTx.transactionId.toString()}`
          : `https://hashscan.io/testnet/transaction/${contractExecTx.transactionId.toString()}`
      }`
    );

    console.log('\n🎯 Next Steps:');
    console.log('   - Check balances: npm run query:balance');
    console.log('   - View transactions: npm run query:transactions');
    console.log('   - Consume energy: npm run consume:energy');
  } catch (error) {
    console.error('\n❌ Error transferring energy:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INSUFFICIENT_GAS')) {
        console.error('\n💡 Solution: The transaction ran out of gas. Increase gas limit.');
      } else if (error.message.includes('INSUFFICIENT_TX_FEE')) {
        console.error('\n💡 Solution: Your account needs more HBAR.');
      } else if (error.message.includes('CONTRACT_REVERT')) {
        console.error('\n💡 Possible reasons:');
        console.error('   - Seller has insufficient virtual balance');
        console.error('   - Not contract owner');
        console.error('   - Invalid address format');
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

/**
 * Converts Hedera account ID to EVM address format
 * @param accountId Account ID in format "0.0.xxxxx"
 * @returns EVM-compatible address (20 bytes = 40 hex characters)
 */
function accountIdToAddress(accountId: string): string {
  const parts = accountId.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid account ID format: ${accountId}. Expected format: 0.0.xxxxx`);
  }

  const shard = parseInt(parts[0]);
  const realm = parseInt(parts[1]);
  const num = parseInt(parts[2]);

  if (isNaN(shard) || isNaN(realm) || isNaN(num)) {
    throw new Error(`Invalid account ID: ${accountId}`);
  }

  const shardHex = shard.toString(16).padStart(8, '0');
  const realmHex = realm.toString(16).padStart(16, '0');
  const numHex = num.toString(16).padStart(16, '0');

  return `0x${shardHex}${realmHex}${numHex}`;
}

// Run the script
transferEnergy().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
