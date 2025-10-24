import { ethers } from 'ethers';

/**
 * Generates a signature for recordProductionAndMint
 *
 * @param producer The producer address (EVM format)
 * @param kwh The kWh amount
 * @param deadline The deadline timestamp
 * @param privateKey The owner's private key (hex format with 0x prefix)
 * @returns The signature as hex string
 */
export async function signRecordProduction(
  producer: string,
  kwh: number,
  deadline: number,
  privateKey: string
): Promise<string> {
  // Create wallet from private key
  const wallet = new ethers.Wallet(privateKey);

  // Create message hash (same as contract's getMessageHash)
  const messageHash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'uint256'],
    [producer, kwh, deadline]
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
  signature: string,
  expectedSigner: string
): boolean {
  // Create message hash
  const messageHash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'uint256'],
    [producer, kwh, deadline]
  );

  // Recover signer from signature
  const recoveredSigner = ethers.verifyMessage(ethers.getBytes(messageHash), signature);

  return recoveredSigner.toLowerCase() === expectedSigner.toLowerCase();
}
