import { PrivateKey } from '@hashgraph/sdk';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

async function testKeys() {
  console.log('🔑 Testing private keys...\n');

  const accountId = process.env.HEDERA_TESTNET_ACCOUNT_ID!;
  console.log(`Account ID: ${accountId}\n`);

  // Test HEDERA_TESTNET_HEX_PRIVATE_KEY (hex format)
  console.log('📋 HEDERA_TESTNET_HEX_PRIVATE_KEY:');
  try {
    const hexKey = process.env.HEDERA_TESTNET_HEX_PRIVATE_KEY!;
    const wallet = new ethers.Wallet(hexKey);
    console.log(`   Hex Key: ${hexKey.substring(0, 10)}...`);
    console.log(`   Address: ${wallet.address}`);
  } catch (error) {
    console.log('   Error:', error);
  }

  // Test HEDERA_DER_TESTNET_PRIVATE_KEY (DER format)
  console.log('\n📋 HEDERA_DER_TESTNET_PRIVATE_KEY (DER):');
  try {
    const derKey = process.env.HEDERA_DER_TESTNET_PRIVATE_KEY!;
    const privateKey = PrivateKey.fromStringDer(derKey);

    // Convert to hex
    const hexKey = '0x' + privateKey.toStringRaw();
    const wallet = new ethers.Wallet(hexKey);

    console.log(`   DER Key: ${derKey.substring(0, 20)}...`);
    console.log(`   Hex Key: ${hexKey.substring(0, 10)}...`);
    console.log(`   Address: ${wallet.address}`);
  } catch (error) {
    console.log('   Error:', error);
  }

  console.log('\n🎯 Expected owner address: 0x00000000000000000000000000000000006c72e0');
}

testKeys().catch(console.error);
