import { ethers } from 'ethers';

/**
 * Generates a signature for recordProductionAndMint
 *
 * @param producer The producer address (EVM format)
 * @param kwh The kWh amount
 * @param deadline The deadline timestamp
 * @param contractAddress The SPARKController contract address
 * @param chainId The chain ID (296 for Hedera testnet)
 * @param privateKey The owner's private key (hex format with 0x prefix)
 * @returns The signature as hex string
 */
export async function signRecordProduction(
  producer: string,
  kwh: number,
  deadline: number,
  contractAddress: string,
  chainId: number,
  privateKey: string
): Promise<string> {
  // Create wallet from private key
  const wallet = new ethers.Wallet(privateKey);

  // Create message hash (same as contract's getMessageHash)
  // Now includes contractAddress and chainId to prevent replay attacks
  const messageHash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'uint256', 'address', 'uint256'],
    [producer, kwh, deadline, contractAddress, chainId]
  );

  // Sign the message hash
  const signature = await wallet.signMessage(ethers.getBytes(messageHash));

  return signature;
}

/**
 * Verifies a signature locally (for testing)
 */
export function verifySignature(
  producer: string,
  kwh: number,
  deadline: number,
  contractAddress: string,
  chainId: number,
  signature: string,
  expectedSigner: string
): boolean {
  // Create message hash (must match contract's getMessageHash)
  const messageHash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'uint256', 'address', 'uint256'],
    [producer, kwh, deadline, contractAddress, chainId]
  );

  // Recover signer from signature
  const recoveredSigner = ethers.verifyMessage(ethers.getBytes(messageHash), signature);

  return recoveredSigner.toLowerCase() === expectedSigner.toLowerCase();
}
