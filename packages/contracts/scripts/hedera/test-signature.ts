import dotenv from 'dotenv';
import { ethers } from 'ethers';

import { signRecordProduction } from './utils/signature.js';

dotenv.config();

async function testSignature() {
  console.log('🧪 Testing signature generation and verification...\n');

  const producer = '0x00000000000000000000000000000000006c72e0';
  const kwh = 10;
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const privateKeyHex = process.env.HEDERA_TESTNET_HEX_PRIVATE_KEY!;
  const contractAddress = process.env.TESTNET_SPARK_CONTROLLER_ADDRESS || '0x0000000000000000000000000000000000000000';
  const chainId = 296; // Hedera testnet

  console.log('📋 Parameters:');
  console.log(`   Producer: ${producer}`);
  console.log(`   kWh: ${kwh}`);
  console.log(`   Deadline: ${deadline} (${new Date(deadline * 1000).toISOString()})`);
  console.log(`   Contract Address: ${contractAddress}`);
  console.log(`   Chain ID: ${chainId}`);

  // Create wallet
  const wallet = new ethers.Wallet(privateKeyHex);
  const ownerAddress = wallet.address;

  console.log(`\n🔑 Owner Address: ${ownerAddress}\n`);

  // Generate signature
  console.log('⏳ Generating signature...');
  const signature = await signRecordProduction(producer, kwh, deadline, contractAddress, chainId, privateKeyHex);

  console.log(`   Signature: ${signature}`);

  // Verify signature locally
  console.log('\n⏳ Verifying signature...');

  // Create message hash (must match contract's getMessageHash - includes contractAddress and chainId)
  const messageHash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'uint256', 'address', 'uint256'],
    [producer, kwh, deadline, contractAddress, chainId]
  );

  console.log(`   Message Hash: ${messageHash}`);

  // Recover signer from signature
  const recoveredSigner = ethers.verifyMessage(ethers.getBytes(messageHash), signature);

  console.log(`   Recovered Signer: ${recoveredSigner}`);
  console.log(`   Expected Owner: ${ownerAddress}`);
  console.log(
    `   Match: ${recoveredSigner.toLowerCase() === ownerAddress.toLowerCase() ? '✅ YES' : '❌ NO'}`
  );

  if (recoveredSigner.toLowerCase() === ownerAddress.toLowerCase()) {
    console.log('\n✅ Signature verification passed!');
    console.log('   The signature should work with the contract.');
  } else {
    console.log('\n❌ Signature verification FAILED!');
    console.log('   The signature will NOT work with the contract.');
  }
}

testSignature().catch(console.error);
