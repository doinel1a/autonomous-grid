# SPARK Token - User Guide

## Overview

SPARK is a fungible token on Hedera Token Service (HTS) that represents solar energy production in a Virtual Power Plant (VPP) system.

**Token Economics:** 1 SPARK = 1 Wh of solar energy (with 8 decimals precision)

## Key Features

- **Dynamic Supply**: No initial or maximum supply - tokens are minted as energy is produced
- **Production Tracking**: Every mint operation records the producer, amount, and timestamp
- **Aggregated Analytics**: Hourly and daily production statistics
- **Energy Trading**: Peer-to-peer energy offers marketplace
- **Virtual Balance System**: Energy credits with locked balance management
- **Transparent**: All production data and transactions stored on-chain
- **Energy Traceability**: Complete history of energy production and trading per producer

## Getting Started

### Prerequisites

1. **Hedera Account**: You need a Hedera testnet account
   - Create one at: [Hedera Portal](https://portal.hedera.com/)
   - Get testnet HBAR from the [faucet](https://portal.hedera.com/faucet)

2. **Environment Setup**: Configure your `.env` file with:
   ```
   HEDERA_NETWORK='testnet'
   HEDERA_TESTNET_ACCOUNT_ID='0.0.xxxxx'
   HEDERA_DER_TESTNET_PRIVATE_KEY='your_private_key'
   ```

For detailed setup instructions, see [HEDERA_SETUP.md](./HEDERA_SETUP.md)

### Installation

```bash
cd packages/contracts
npm install
npm run compile
```

## Workflow

### 1. Create SPARK Token

Create the HTS token on Hedera:

```bash
npm run create:spark
```

This will:

- Create a fungible token named "SPARK" (symbol: SPRK)
- Set up dynamic supply (mint/burn enabled)
- Configure your account as treasury
- Save token ID to `.env`

**Output:**

```
✅ SPARK Token created successfully!
Token ID: 0.0.12345
```

### 2. Deploy SPARKController Contract

Deploy the controller contract that manages token operations:

```bash
npm run deploy:controller:testnet
```

This will:

- Deploy SPARKController smart contract
- Configure it with the SPARK token
- Set you as the contract owner
- Save contract address to `.env`

**Output:**

```
✅ SPARKController deployed successfully!
Contract ID: 0.0.67890
```

### 3. Record Production and Mint Tokens

When solar energy is produced, record it and mint corresponding SPARK tokens:

```bash
# Using environment variables
PRODUCER_ADDRESS="0.0.12345" KWH_AMOUNT="10" npm run mint:spark

# Or edit the script defaults
npm run mint:spark
```

**Parameters:**

- `PRODUCER_ADDRESS`: Address of the energy producer (defaults to your account)
- `KWH_AMOUNT`: Amount of energy produced in kWh (e.g., 10 kWh → 10,000 SPARK)

**Output:**

```
✅ Production recorded and tokens minted successfully!
Energy Produced: 10 kWh
SPARK Minted: 10000 SPARK
```

### 4. Query Production Data

View production statistics for a producer:

```bash
# Query your own production
npm run query:production

# Query specific producer
QUERY_PRODUCER_ADDRESS="0.0.12345" npm run query:production
```

**Output:**

```
📊 SPARK Production Summary
Producer: 0.0.12345
Total Production:     50000 SPARK
                      50 kWh
Production Records:   5
```

### 5. Burn Tokens

Burn tokens when energy is consumed or sold:

```bash
# Burn 1000 SPARK (1 kWh equivalent)
BURN_AMOUNT="1000" npm run burn:spark
```

**Output:**

```
✅ Tokens burned successfully!
Burned Amount: 1000 SPARK
Energy Equivalent: 1 kWh
```

### 6. Query Token Information

Check token details and supply:

```bash
npm run query:spark
```

**Output:**

```
📊 SPARK Token Information:
Token ID:           0.0.12345
Name:               SPARK
Symbol:             SPRK
Decimals:           8
Total Supply:       50000 SPARK
```

## Use Cases

### Solar Panel Owner

1. Install solar panels and monitoring system
2. System records energy production
3. Automatically mint SPARK tokens based on production
4. Track lifetime energy production on-chain
5. Sell or trade SPARK tokens representing your energy

### Energy Consumer

1. Purchase SPARK tokens representing solar energy
2. Burn tokens as you consume energy
3. Verify energy source and production time on-chain
4. Track your renewable energy consumption

### VPP Operator

1. Manage multiple producers (solar panel owners)
2. Mint tokens for each producer based on their production
3. Aggregate production data across all producers
4. Generate reports and analytics
5. Facilitate peer-to-peer energy trading

## Advanced Features

### Batch Production Recording

Record multiple producers' production in one transaction (more gas-efficient):

```typescript
// Coming in future version
// npm run mint:spark:batch --file=production-data.json
```

### Production Analytics

Query specific time ranges and aggregates:

- **Daily Production**: Total energy produced on a specific day
- **Hourly Production**: Production per hour for granular analytics
- **Range Queries**: Production between any two timestamps
- **Global Statistics**: Total records, total production across all producers

### Event Tracking

All operations emit events for off-chain indexing:

- `ProductionRecorded`: New production entry
- `TokensMinted`: Tokens created
- `TokensBurned`: Tokens destroyed
- `OwnershipTransferred`: Contract ownership changed

## Security & Permissions

### Access Control

- **Owner Only**: Only the contract owner can:
  - Mint tokens and record production
  - Burn tokens
  - Transfer contract ownership

- **Public Queries**: Anyone can:
  - View production records
  - Query aggregated statistics
  - Check token information

### Best Practices

1. **Secure Your Keys**: Never share or commit private keys
2. **Verify Transactions**: Always check transaction details before signing
3. **Test First**: Use testnet before mainnet deployment
4. **Monitor Activity**: Regularly check production records and token supply
5. **Backup Data**: Keep local records as backup

## Troubleshooting

### Common Errors

#### "INSUFFICIENT_TX_FEE"

**Problem**: Not enough HBAR for transaction fees
**Solution**: Request more testnet HBAR from [faucet](https://portal.hedera.com/faucet)

#### "TOKEN_NOT_ASSOCIATED"

**Problem**: Token not associated with account
**Solution**: Run `npm run associate:token`

#### "UnauthorizedAccess"

**Problem**: Attempting operation without proper permissions
**Solution**: Ensure you're using the contract owner account

#### "CONTRACT_REVERT"

**Problem**: Transaction reverted by contract logic
**Solution**: Check:

- You're the contract owner
- Parameters are valid (non-zero addresses, positive amounts)
- Token is properly configured

### Getting Help

1. Check the [Developer Guide](./SPARK_DEVELOPER.md)
2. Review [Hedera Setup](./HEDERA_SETUP.md)
3. Inspect transaction on [HashScan](https://hashscan.io/testnet)
4. Check contract logs and error messages

## Economics & Tokenomics

### Conversion Rate

```
1000 SPARK = 1 kWh
```

This rate is fixed in the smart contract and cannot be changed.

### Examples

| Energy (kWh) | SPARK Tokens | Use Case                            |
| ------------ | ------------ | ----------------------------------- |
| 0.001        | 1            | Minimum trackable unit              |
| 1            | 1,000        | Small residential hourly production |
| 10           | 10,000       | Daily residential production        |
| 100          | 100,000      | Small commercial installation       |
| 1,000        | 1,000,000    | Large commercial / small VPP        |

### Supply Dynamics

- **No Initial Supply**: Token starts with 0 total supply
- **Dynamic Minting**: Supply increases as energy is produced
- **Dynamic Burning**: Supply decreases as energy is consumed/sold
- **No Max Supply**: Unlimited supply to accommodate growing VPP

## Network Information

### Testnet

- **Network**: Hedera Testnet
- **Explorer**: https://hashscan.io/testnet
- **Faucet**: https://portal.hedera.com/faucet
- **RPC**: https://testnet.hashio.io/api

### Mainnet (Future)

When moving to production:

1. Update `.env`: `HEDERA_NETWORK='mainnet'`
2. Use mainnet account with real HBAR
3. Re-run deployment scripts
4. Update all references to mainnet URLs

**⚠️ Important**: Mainnet transactions cost real HBAR. Test thoroughly on testnet first!

## Energy Offers System (NEW!)

The SPARK system now includes a **peer-to-peer energy trading marketplace** where producers can sell their energy directly.

### Creating Energy Offers

As a registered producer, you can create sell offers:

```bash
# Create offer: Sell 1 kWh at 0.15 EUR/kWh
OFFER_AMOUNT_WH=1000 OFFER_PRICE_PER_KWH=15000000 npm run create:offer
```

**What you need**:
- ✅ Be a registered producer (have recorded at least one production)
- ✅ Have available energy in your virtual balance

### Viewing Offers

```bash
# View all active offers
npm run query:offers

# View your offers
QUERY_TYPE=seller SELLER_ADDRESS=0.0.xxxxx npm run query:offers

# View specific offer
OFFER_ID=0 npm run query:offers
```

### Managing Your Offers

```bash
# Cancel an offer you created
OFFER_ID=0 npm run cancel:offer
```

### How It Works

1. **Create Offer**: Your energy is locked to prevent double-spending
2. **VPP Matching**: The VPP AI agent matches your offer with buyers
3. **Transfer**: Energy credits move from you to the buyer
4. **Unlock**: Matched energy is unlocked and transferred

### Offer Status Lifecycle

- **ACTIVE**: Available for matching
- **COMPLETED**: Fully matched and executed
- **PARTIALLY_FILLED**: Partially matched, new offer created with remainder
- **CANCELLED**: Cancelled by you or contract owner

### Virtual Balance System

Your energy balance has two components:

```
Virtual Balance:   Total energy credits you own
Locked Balance:    Energy in active offers
Available Balance: Virtual - Locked (can be used/sold)
```

**Important**: Locked energy cannot be transferred or consumed until the offer is matched or cancelled.

For detailed information, see [Energy Offers Guide](./ENERGY_OFFERS.md).

---

## Roadmap

### Current Features (v2.0)

- ✅ HTS token creation
- ✅ Smart contract controller
- ✅ Production tracking and minting
- ✅ Token burning and consumption
- ✅ Energy transfer between users
- ✅ Query functions and analytics
- ✅ Hourly and daily aggregates
- ✅ **Peer-to-peer energy offers marketplace** (NEW!)
- ✅ **Virtual balance with locked balance system** (NEW!)
- ✅ **Full and partial offer matching** (NEW!)
- ✅ **Grid price tracking with EUR/USD conversion** (NEW!)

### Planned Features

- 🔄 Batch production recording
- 🔄 Web dashboard for analytics
- 🔄 API for programmatic access
- 🔄 Integration with IoT devices
- 🔄 Automated offer matching algorithms
- 🔄 Carbon credit calculation
- 🔄 Multi-signature support

## Resources

- [Hedera Documentation](https://docs.hedera.com/)
- [Hedera Token Service](https://docs.hedera.com/hedera/sdks-and-apis/sdks/token-service)
- [HashScan Explorer](https://hashscan.io/)
- [Hedera Portal](https://portal.hedera.com/)
- [Smart Contract Developer Guide](./SPARK_DEVELOPER.md)

## Support

For technical support or questions:

- Review documentation in `/docs`
- Check the implementation plan: `SPARK_IMPLEMENTATION_PLAN.md`
- Inspect contract source: `contracts/SPARKController.sol`

---

**Built for the Autonomous Grid VPP System**
_Empowering renewable energy through blockchain technology_
