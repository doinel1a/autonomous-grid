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
 * Queries energy buy offers from the SPARKController contract
 *
 * Usage:
 *   npm run query:buy-offers                        # Query all active buy offers
 *   QUERY_TYPE=buyer BUYER_ADDRESS=0.0.12345 npm run query:buy-offers  # Query by buyer
 *   QUERY_TYPE=all npm run query:buy-offers         # Query all buy offers (history)
 *   BUY_OFFER_ID=0 npm run query:buy-offers         # Query specific buy offer by ID
 */
async function queryBuyOffers() {
  console.log('🔍 Querying energy buy offers...\n');

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
  const buyerAddress = process.env.BUYER_ADDRESS || accountId;
  const offerId = process.env.BUY_OFFER_ID ? parseInt(process.env.BUY_OFFER_ID) : null;
  const offset = process.env.OFFSET ? parseInt(process.env.OFFSET) : 0;
  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT) : 10;

  console.log(`📋 Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Controller: ${controllerAddress}`);
  console.log(`   Query Type: ${queryType}`);
  if (queryType === 'buyer') console.log(`   Buyer: ${buyerAddress}`);
  if (offerId !== null) console.log(`   Buy Offer ID: ${offerId}`);
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
      // Query specific buy offer by ID
      await queryBuyOfferById(client, controllerAddress, iface, offerId);
    } else if (queryType === 'buyer') {
      // Query buy offers by buyer
      await queryBuyOffersByBuyer(client, controllerAddress, iface, buyerAddress, offset, limit);
    } else if (queryType === 'all') {
      // Query all buy offers (history)
      await queryAllBuyOffers(client, controllerAddress, iface, offset, limit);
    } else {
      // Query active buy offers (default)
      await queryActiveBuyOffers(client, controllerAddress, iface, offset, limit);
    }

    // Query counts
    await queryBuyOfferCounts(client, controllerAddress, iface);
  } catch (error) {
    console.error('\n❌ Error querying buy offers:');
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

async function queryBuyOfferById(
  client: Client,
  contractAddress: string,
  iface: ethers.Interface,
  offerId: number
) {
  console.log(`⏳ Querying buy offer #${offerId}...\n`);

  const query = new ContractCallQuery()
    .setContractId(ContractId.fromSolidityAddress(contractAddress))
    .setGas(100000)
    .setFunction('getBuyOfferById', new ContractFunctionParameters().addUint256(offerId));

  const result = await query.execute(client);
  const decoded = iface.decodeFunctionResult('getBuyOfferById', result.bytes);

  const buyOffer = decoded[0];
  displayBuyOffer(buyOffer);
}

async function queryActiveBuyOffers(
  client: Client,
  contractAddress: string,
  iface: ethers.Interface,
  offset: number,
  limit: number
) {
  console.log(`⏳ Querying active buy offers (offset: ${offset}, limit: ${limit})...\n`);

  const query = new ContractCallQuery()
    .setContractId(ContractId.fromSolidityAddress(contractAddress))
    .setGas(300000)
    .setFunction(
      'getActiveBuyOffers',
      new ContractFunctionParameters().addUint256(offset).addUint256(limit)
    );

  const result = await query.execute(client);
  const decoded = iface.decodeFunctionResult('getActiveBuyOffers', result.bytes);

  const buyOffers = decoded[0];
  console.log(`📊 Found ${buyOffers.length} active buy offers:\n`);
  buyOffers.forEach((buyOffer: any, index: number) => {
    console.log(`--- Buy Offer #${index + 1} ---`);
    displayBuyOffer(buyOffer);
    console.log('');
  });
}

async function queryBuyOffersByBuyer(
  client: Client,
  contractAddress: string,
  iface: ethers.Interface,
  buyerAddress: string,
  offset: number,
  limit: number
) {
  // Convert buyer address to EVM format if needed
  let evmBuyerAddress: string;
  if (buyerAddress.includes('.')) {
    evmBuyerAddress = accountIdToAddress(buyerAddress);
    console.log(`   Buyer EVM Address: ${evmBuyerAddress}\n`);
  } else {
    evmBuyerAddress = buyerAddress;
  }

  console.log(`⏳ Querying buy offers by buyer (offset: ${offset}, limit: ${limit})...\n`);

  const query = new ContractCallQuery()
    .setContractId(ContractId.fromSolidityAddress(contractAddress))
    .setGas(300000)
    .setFunction(
      'getBuyOffersByBuyer',
      new ContractFunctionParameters()
        .addAddress(evmBuyerAddress)
        .addUint256(offset)
        .addUint256(limit)
    );

  const result = await query.execute(client);
  const decoded = iface.decodeFunctionResult('getBuyOffersByBuyer', result.bytes);

  const buyOffers = decoded[0];
  console.log(`📊 Found ${buyOffers.length} buy offers for buyer:\n`);
  buyOffers.forEach((buyOffer: any, index: number) => {
    console.log(`--- Buy Offer #${index + 1} ---`);
    displayBuyOffer(buyOffer);
    console.log('');
  });
}

async function queryAllBuyOffers(
  client: Client,
  contractAddress: string,
  iface: ethers.Interface,
  offset: number,
  limit: number
) {
  console.log(`⏳ Querying all buy offers (offset: ${offset}, limit: ${limit})...\n`);

  const query = new ContractCallQuery()
    .setContractId(ContractId.fromSolidityAddress(contractAddress))
    .setGas(300000)
    .setFunction(
      'getAllBuyOffers',
      new ContractFunctionParameters().addUint256(offset).addUint256(limit)
    );

  const result = await query.execute(client);
  const decoded = iface.decodeFunctionResult('getAllBuyOffers', result.bytes);

  const buyOffers = decoded[0];
  console.log(`📊 Found ${buyOffers.length} buy offers (total history):\n`);
  buyOffers.forEach((buyOffer: any, index: number) => {
    console.log(`--- Buy Offer #${index + 1} ---`);
    displayBuyOffer(buyOffer);
    console.log('');
  });
}

async function queryBuyOfferCounts(
  client: Client,
  contractAddress: string,
  iface: ethers.Interface
) {
  console.log('\n📈 Buy Offer Statistics:\n');

  // Total buy offers count
  const totalQuery = new ContractCallQuery()
    .setContractId(ContractId.fromSolidityAddress(contractAddress))
    .setGas(50000)
    .setFunction('getTotalBuyOffersCount');

  const totalResult = await totalQuery.execute(client);
  const totalDecoded = iface.decodeFunctionResult('getTotalBuyOffersCount', totalResult.bytes);
  console.log(`   Total Buy Offers: ${totalDecoded[0].toString()}`);

  // Active buy offers count
  const activeQuery = new ContractCallQuery()
    .setContractId(ContractId.fromSolidityAddress(contractAddress))
    .setGas(100000)
    .setFunction('getActiveBuyOffersCount');

  const activeResult = await activeQuery.execute(client);
  const activeDecoded = iface.decodeFunctionResult('getActiveBuyOffersCount', activeResult.bytes);
  console.log(`   Active Buy Offers: ${activeDecoded[0].toString()}`);
}

function displayBuyOffer(buyOffer: any) {
  const statusMap = ['ACTIVE', 'CANCELLED', 'COMPLETED', 'PARTIALLY_FILLED'];
  const offerId = buyOffer.offerId.toString();
  const buyer = buyOffer.buyer;
  const amountWh = buyOffer.amountWh.toString();
  const maxPricePerKwh = buyOffer.maxPricePerKwh.toString();
  const timestamp = new Date(Number(buyOffer.timestamp) * 1000).toISOString();
  const status = statusMap[buyOffer.status];

  console.log(`   Buy Offer ID: ${offerId}`);
  console.log(`   Buyer: ${buyer}`);
  console.log(`   Amount: ${amountWh} Wh (${Number(amountWh) / 1000} kWh)`);
  console.log(
    `   Max Price: ${Number(maxPricePerKwh) / 100000000} EUR/kWh (${maxPricePerKwh} smallest units)`
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
queryBuyOffers().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
