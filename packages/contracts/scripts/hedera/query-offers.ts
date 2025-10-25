import 'dotenv/config';

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  Client,
  ContractCallQuery,
  ContractFunctionParameters,
  ContractId,
  PrivateKey
} from '@hashgraph/sdk';
import { ethers } from 'ethers';

/**
 * Queries energy offers from the SPARKController contract
 *
 * Usage:
 *   npm run query:offers                        # Query all active offers
 *   QUERY_TYPE=seller SELLER_ADDRESS=0.0.12345 npm run query:offers  # Query by seller
 *   QUERY_TYPE=all npm run query:offers         # Query all offers (history)
 *   OFFER_ID=0 npm run query:offers             # Query specific offer by ID
 */
async function queryOffers() {
  console.log('🔍 Querying energy offers...\n');

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
      '❌ Missing SPARK configuration in .env:\n' +
        '   - TESTNET_SPARK_CONTROLLER_ADDRESS (run: npm run deploy:controller:testnet)'
    );
  }

  const queryType = process.env.QUERY_TYPE || 'active';
  const sellerAddress = process.env.SELLER_ADDRESS || accountId;
  const offerId = process.env.OFFER_ID ? parseInt(process.env.OFFER_ID) : null;
  const offset = process.env.OFFSET ? parseInt(process.env.OFFSET) : 0;
  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT) : 10;

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  console.log(`   Query Type: ${queryType}`);
  if (queryType === 'seller') console.log(`   Seller: ${sellerAddress}`);
  if (offerId !== null) console.log(`   Offer ID: ${offerId}`);
  console.log(`   Offset: ${offset}, Limit: ${limit}\n`);

  // Initialize Hedera client
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const privateKey = PrivateKey.fromStringDer(privateKeyStr);
  client.setOperator(accountId, privateKey);

  try {
    // Get contract ABI
    const abi = getContractABI();
    const iface = new ethers.Interface(abi);

    if (offerId !== null) {
      // Query specific offer by ID
      await queryOfferById(client, controllerAddress, iface, offerId);
    } else if (queryType === 'seller') {
      // Query offers by seller
      await queryOffersBySeller(client, controllerAddress, iface, sellerAddress, offset, limit);
    } else if (queryType === 'all') {
      // Query all offers (history)
      await queryAllOffers(client, controllerAddress, iface, offset, limit);
    } else {
      // Query active offers (default)
      await queryActiveOffers(client, controllerAddress, iface, offset, limit);
    }

    // Query counts
    await queryOfferCounts(client, controllerAddress, iface);
  } catch (error) {
    console.error('\n❌ Error querying offers:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes('INVALID_CONTRACT_ID')) {
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

async function queryOfferById(
  client: Client,
  contractAddress: string,
  iface: ethers.Interface,
  offerId: number
) {
  console.log(`⏳ Querying offer #${offerId}...\n`);

  const query = new ContractCallQuery()
    .setContractId(ContractId.fromSolidityAddress(contractAddress))
    .setGas(100000)
    .setFunction('getOfferById', new ContractFunctionParameters().addUint256(offerId));

  const result = await query.execute(client);
  const decoded = iface.decodeFunctionResult('getOfferById', result.bytes);

  const offer = decoded[0];
  displayOffer(offer);
}

async function queryActiveOffers(
  client: Client,
  contractAddress: string,
  iface: ethers.Interface,
  offset: number,
  limit: number
) {
  console.log(`⏳ Querying active offers (offset: ${offset}, limit: ${limit})...\n`);

  const query = new ContractCallQuery()
    .setContractId(ContractId.fromSolidityAddress(contractAddress))
    .setGas(300000)
    .setFunction(
      'getActiveOffers',
      new ContractFunctionParameters().addUint256(offset).addUint256(limit)
    );

  const result = await query.execute(client);
  const decoded = iface.decodeFunctionResult('getActiveOffers', result.bytes);

  const offers = decoded[0];
  console.log(`📊 Found ${offers.length} active offers:\n`);
  offers.forEach((offer: any, index: number) => {
    console.log(`--- Offer #${index + 1} ---`);
    displayOffer(offer);
    console.log('');
  });
}

async function queryOffersBySeller(
  client: Client,
  contractAddress: string,
  iface: ethers.Interface,
  sellerAddress: string,
  offset: number,
  limit: number
) {
  // Convert seller address to EVM format if needed
  let evmSellerAddress: string;
  if (sellerAddress.includes('.')) {
    evmSellerAddress = accountIdToAddress(sellerAddress);
    console.log(`   Seller EVM Address: ${evmSellerAddress}\n`);
  } else {
    evmSellerAddress = sellerAddress;
  }

  console.log(`⏳ Querying offers by seller (offset: ${offset}, limit: ${limit})...\n`);

  const query = new ContractCallQuery()
    .setContractId(ContractId.fromSolidityAddress(contractAddress))
    .setGas(300000)
    .setFunction(
      'getOffersBySeller',
      new ContractFunctionParameters()
        .addAddress(evmSellerAddress)
        .addUint256(offset)
        .addUint256(limit)
    );

  const result = await query.execute(client);
  const decoded = iface.decodeFunctionResult('getOffersBySeller', result.bytes);

  const offers = decoded[0];
  console.log(`📊 Found ${offers.length} offers for seller:\n`);
  offers.forEach((offer: any, index: number) => {
    console.log(`--- Offer #${index + 1} ---`);
    displayOffer(offer);
    console.log('');
  });
}

async function queryAllOffers(
  client: Client,
  contractAddress: string,
  iface: ethers.Interface,
  offset: number,
  limit: number
) {
  console.log(`⏳ Querying all offers (offset: ${offset}, limit: ${limit})...\n`);

  const query = new ContractCallQuery()
    .setContractId(ContractId.fromSolidityAddress(contractAddress))
    .setGas(300000)
    .setFunction(
      'getAllOffers',
      new ContractFunctionParameters().addUint256(offset).addUint256(limit)
    );

  const result = await query.execute(client);
  const decoded = iface.decodeFunctionResult('getAllOffers', result.bytes);

  const offers = decoded[0];
  console.log(`📊 Found ${offers.length} offers (total history):\n`);
  offers.forEach((offer: any, index: number) => {
    console.log(`--- Offer #${index + 1} ---`);
    displayOffer(offer);
    console.log('');
  });
}

async function queryOfferCounts(
  client: Client,
  contractAddress: string,
  iface: ethers.Interface
) {
  console.log('\n📈 Offer Statistics:\n');

  // Total offers count
  const totalQuery = new ContractCallQuery()
    .setContractId(ContractId.fromSolidityAddress(contractAddress))
    .setGas(50000)
    .setFunction('getTotalOffersCount');

  const totalResult = await totalQuery.execute(client);
  const totalDecoded = iface.decodeFunctionResult('getTotalOffersCount', totalResult.bytes);
  console.log(`   Total Offers: ${totalDecoded[0].toString()}`);

  // Active offers count
  const activeQuery = new ContractCallQuery()
    .setContractId(ContractId.fromSolidityAddress(contractAddress))
    .setGas(100000)
    .setFunction('getActiveOffersCount');

  const activeResult = await activeQuery.execute(client);
  const activeDecoded = iface.decodeFunctionResult('getActiveOffersCount', activeResult.bytes);
  console.log(`   Active Offers: ${activeDecoded[0].toString()}`);
}

function displayOffer(offer: any) {
  const statusMap = ['ACTIVE', 'CANCELLED', 'COMPLETED', 'PARTIALLY_FILLED'];
  const offerId = offer.offerId.toString();
  const seller = offer.seller;
  const amountWh = offer.amountWh.toString();
  const pricePerKwh = offer.pricePerKwh.toString();
  const timestamp = new Date(Number(offer.timestamp) * 1000).toISOString();
  const status = statusMap[offer.status];

  console.log(`   Offer ID: ${offerId}`);
  console.log(`   Seller: ${seller}`);
  console.log(`   Amount: ${amountWh} Wh (${Number(amountWh) / 1000} kWh)`);
  console.log(
    `   Price: ${Number(pricePerKwh) / 100000000} EUR/kWh (${pricePerKwh} smallest units)`
  );
  console.log(`   Timestamp: ${timestamp}`);
  console.log(`   Status: ${status}`);
}

function getContractABI(): any {
  try {
    const artifactPath = join(
      process.cwd(),
      'artifacts',
      'contracts',
      'SPARKController.sol',
      'SPARKController.json'
    );

    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
    return artifact.abi;
  } catch (error) {
    throw new Error('Contract artifact not found. Please compile first: npm run compile');
  }
}

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
queryOffers().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
