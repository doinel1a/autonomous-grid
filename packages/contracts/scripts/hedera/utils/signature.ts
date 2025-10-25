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
 * Generates a signature for createEnergyOffer
 *
 * @param seller The seller address (EVM format)
 * @param amountWh The amount in Wh
 * @param pricePerKwh The price per kWh (with 8 decimals)
 * @param deadline The deadline timestamp
 * @param contractAddress The SPARKController contract address
 * @param chainId The chain ID (296 for Hedera testnet)
 * @param privateKey The owner's private key (hex format with 0x prefix)
 * @returns The signature as hex string
 */
export async function signCreateOffer(
  seller: string,
  amountWh: number,
  pricePerKwh: number,
  deadline: number,
  contractAddress: string,
  chainId: number,
  privateKey: string
): Promise<string> {
  // Create wallet from private key
  const wallet = new ethers.Wallet(privateKey);

  // Create message hash (same as contract's _verifyOfferSignature)
  // Includes contractAddress and chainId to prevent replay attacks
  const messageHash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
    [seller, amountWh, pricePerKwh, deadline, contractAddress, chainId]
  );

  // Sign the message hash
  const signature = await wallet.signMessage(ethers.getBytes(messageHash));

  return signature;
}

/**
 * Generates a signature for createEnergyBuyOffer
 *
 * @param buyer The buyer address (EVM format)
 * @param amountWh The amount in Wh
 * @param maxPricePerKwh The max price per kWh (with 8 decimals)
 * @param deadline The deadline timestamp
 * @param contractAddress The SPARKController contract address
 * @param chainId The chain ID (296 for Hedera testnet)
 * @param privateKey The owner's private key (hex format with 0x prefix)
 * @returns The signature as hex string
 */
export async function signCreateBuyOffer(
  buyer: string,
  amountWh: number,
  maxPricePerKwh: number,
  deadline: number,
  contractAddress: string,
  chainId: number,
  privateKey: string
): Promise<string> {
  // Create wallet from private key
  const wallet = new ethers.Wallet(privateKey);

  // Create message hash (same as contract's _verifyBuyOfferSignature)
  // Includes contractAddress and chainId to prevent replay attacks
  const messageHash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
    [buyer, amountWh, maxPricePerKwh, deadline, contractAddress, chainId]
  );

  // Sign the message hash
  const signature = await wallet.signMessage(ethers.getBytes(messageHash));

  return signature;
}

/**
 * Generates a signature for cancelEnergyOffer
 *
 * @param offerId The offer ID to cancel
 * @param deadline The deadline timestamp
 * @param contractAddress The SPARKController contract address
 * @param chainId The chain ID (296 for Hedera testnet)
 * @param privateKey The owner's private key (hex format with 0x prefix)
 * @returns The signature as hex string
 */
export async function signCancelOffer(
  offerId: number,
  deadline: number,
  contractAddress: string,
  chainId: number,
  privateKey: string
): Promise<string> {
  const wallet = new ethers.Wallet(privateKey);

  const messageHash = ethers.solidityPackedKeccak256(
    ['uint256', 'uint256', 'address', 'uint256'],
    [offerId, deadline, contractAddress, chainId]
  );

  return await wallet.signMessage(ethers.getBytes(messageHash));
}

/**
 * Generates a signature for cancelEnergyBuyOffer
 *
 * @param offerId The buy offer ID to cancel
 * @param deadline The deadline timestamp
 * @param contractAddress The SPARKController contract address
 * @param chainId The chain ID (296 for Hedera testnet)
 * @param privateKey The owner's private key (hex format with 0x prefix)
 * @returns The signature as hex string
 */
export async function signCancelBuyOffer(
  offerId: number,
  deadline: number,
  contractAddress: string,
  chainId: number,
  privateKey: string
): Promise<string> {
  const wallet = new ethers.Wallet(privateKey);

  const messageHash = ethers.solidityPackedKeccak256(
    ['uint256', 'uint256', 'address', 'uint256'],
    [offerId, deadline, contractAddress, chainId]
  );

  return await wallet.signMessage(ethers.getBytes(messageHash));
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
