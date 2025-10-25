# Autonomous Grid - Smart Contracts

This package contains smart contracts for the Autonomous Grid Virtual Power Plant (VPP) system, built with Hardhat 3 Beta, Hedera Token Service (HTS), and the `viem` library.

---

## 🚀 Version 2.0 Updates

**Latest Release**: October 2025

### Security Enhancements

✅ **Enhanced Replay Attack Protection**
- Signatures now include contract address and chain ID
- Prevents cross-chain replay (testnet → mainnet)
- Prevents cross-contract replay (different deployments)

✅ **Pyth Oracle Validation**
- Price feeds validated for staleness (max 60 seconds)
- Negative price protection
- Invalid exponent protection

✅ **Gas Optimizations**
- Active offer counters (O(n) → O(1) queries)
- Storage optimization (66% reduction per offer)
- Custom errors instead of require strings

### Breaking Changes

⚠️ **Signature Format Updated**
- Old signatures (v1.0) will NOT work with v2.0 contract
- All signature generation scripts updated
- See [SIGNATURE_VERIFICATION.md](./SIGNATURE_VERIFICATION.md#security-updates-v20) for migration guide

### New Features

- Energy marketplace with buy/sell offers
- Partial offer matching
- Balance locking system
- Grid price oracle integration

---

## Overview

The Autonomous Grid contracts manage solar energy production tracking and tokenization through the SPARK token system on Hedera.

## Key Components

### SPARK Token System

**SPARK** is a fungible token on Hedera Token Service (HTS) that represents solar energy production.

**Economics**: 1000 SPARK = 1 kWh of solar energy

**Token Specifications**:

- **Decimals**: 8 (optimized for HTS uint64 limits)
- **Supply Type**: Infinite (dynamic minting based on production)
- **Max Single Mint**: Up to 184,467,440 SPARK per transaction

#### Components

1. **SPARK Token (HTS)**: Native Hedera fungible token with dynamic supply
2. **SPARKController**: Smart contract managing production tracking, minting, and burning
3. **Signature Verification**: ECDSA-based authorization system for secure operations

#### Features

- ⚡ Dynamic token supply (mint as energy is produced)
- 📊 Production tracking per producer
- 📈 Hourly and daily aggregated statistics
- 🔍 Complete production history on-chain
- 🔐 Enhanced ECDSA signature verification (v2.0: includes contract address + chain ID)
- 🔑 Supply key management (transferred to contract for autonomous operation)
- ⏱️ Multi-layer replay protection (deadline + cross-chain + cross-contract)
- 🏪 Energy marketplace (buy/sell offers with partial matching)
- 🔒 Balance locking system for active offers
- 🌐 Pyth oracle integration for EUR/USD price feeds
- ⛽ Gas-optimized with custom errors, batch operations, and O(1) queries

## Quick Start

### Installation

```bash
npm install
npm run compile
```

### Configuration

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Configure your Hedera account:
   ```env
   HEDERA_NETWORK='testnet'
   HEDERA_TESTNET_ACCOUNT_ID='0.0.xxxxx'
   HEDERA_DER_TESTNET_PRIVATE_KEY='your_private_key'
   ```

See [HEDERA_SETUP.md](./docs/HEDERA_SETUP.md) for detailed setup instructions.

### Testing

Run all tests:

```bash
npm run test
```

Run specific test types:

```bash
npx hardhat test solidity  # Solidity tests
npx hardhat test nodejs    # TypeScript tests
```

### Linting

```bash
npm run lint              # Check Solidity code
npm run lint:fix          # Fix auto-fixable issues
```

## SPARK Token Workflow

### Complete Deployment Process

#### Phase 1: Token Creation

Create the SPARK HTS token with your account as treasury:

```bash
npm run create:spark
```

**Result**: Token created with:

- Admin key: Your account
- Supply key: Your account (temporary)
- Treasury: Your account

#### Phase 2: Controller Deployment

Deploy the SPARKController smart contract:

```bash
npm run deploy:controller:testnet
```

**Result**: Contract deployed with:

- Token address: From TESTNET_SPARK_TOKEN_ID in .env
- Owner address: Derived from HEDERA_TESTNET_HEX_PRIVATE_KEY
- No minting capability yet (supply key still on your account)

#### Phase 3: Privilege Transfer

Transfer the supply key from your account to the contract:

```bash
npm run transfer:supply-key
```

**Result**:

- Supply key: Now held by contract
- Contract can autonomously mint/burn tokens
- Your account retains admin key for emergencies

#### Phase 4: Contract Funding

Fund the contract with HBAR for transaction fees:

```bash
npm run fund:contract
```

**Recommended**: 10 HBAR for operation costs

#### Phase 5: Token Association (if needed)

Associate the SPARK token with the contract:

```bash
npm run associate:token
```

### Production Operations

#### Record Production & Mint

Record energy production and mint tokens with signature verification:

```bash
# Mint 10 kWh (10,000 SPARK) for your account
npm run mint:spark

# Mint for specific producer
PRODUCER_ADDRESS="0.0.12345" KWH_AMOUNT="10" npm run mint:spark
```

**What happens**:

1. Script generates ECDSA signature using HEDERA_TESTNET_HEX_PRIVATE_KEY
2. Signature includes: producer address, kWh amount, and deadline (1 hour)
3. Contract verifies signature matches contract owner
4. If valid, mints tokens and records production

#### Query Data

View production statistics:

```bash
npm run query:production  # View all production records
npm run query:spark       # View token info and balances
npm run query:supply-key  # Verify who holds supply key
```

#### Burn Tokens

Burn tokens when energy is consumed:

```bash
BURN_AMOUNT="1000" npm run burn:spark
```

## Available Scripts

### SPARK Token Operations

| Script                              | Description                                      |
| ----------------------------------- | ------------------------------------------------ |
| `npm run create:spark`              | Create SPARK HTS token (Phase 1)                 |
| `npm run deploy:controller:testnet` | Deploy SPARKController to testnet (Phase 2)      |
| `npm run transfer:supply-key`       | Transfer supply key to contract (Phase 3)        |
| `npm run fund:contract`             | Fund contract with HBAR (Phase 4)                |
| `npm run associate:token`           | Associate token with contract (Phase 5)          |
| `npm run mint:spark`                | Record production and mint tokens with signature |
| `npm run burn:spark`                | Burn SPARK tokens                                |
| `npm run query:spark`               | Query token information and balances             |
| `npm run query:production`          | Query production data and history                |
| `npm run query:supply-key`          | Check who holds the supply key                   |
| `npm run test:signature`            | Test signature generation and verification       |
| `npm run test:keys`                 | Verify private key to address derivation         |

### Development

| Script              | Description              |
| ------------------- | ------------------------ |
| `npm run compile`   | Compile smart contracts  |
| `npm run test`      | Run all tests            |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint`      | Lint Solidity code       |
| `npm run lint:fix`  | Fix linting issues       |
| `npm run clean`     | Clean build artifacts    |

### Legacy (TestToken)

| Script                             | Description                 |
| ---------------------------------- | --------------------------- |
| `npm run setup:testToken:local`    | Setup TestToken locally     |
| `npm run deploy:testToken:sepolia` | Deploy TestToken to Sepolia |

## Project Structure

```
contracts/
├── contracts/
│   ├── SPARKController.sol         # Main controller contract
│   ├── interfaces/
│   │   └── IHederaTokenService.sol # HTS interface
│   ├── TestToken.sol               # ERC-20 test token
│   └── Counter.sol                 # Example contract
├── scripts/
│   └── hedera/
│       ├── create-spark-token.ts   # Create SPARK token
│       ├── deploy-spark-controller.ts # Deploy controller
│       ├── mint-spark.ts           # Mint tokens
│       ├── burn-spark.ts           # Burn tokens
│       ├── query-spark-info.ts     # Query token info
│       ├── query-production.ts     # Query production
│       └── associate-token.ts      # Associate token
├── test/
│   ├── SPARKController.test.ts     # Controller tests
│   └── Counter.ts                  # Example tests
├── docs/
│   ├── SPARK_TOKEN.md              # User guide
│   ├── SPARK_DEVELOPER.md          # Developer guide
│   ├── HEDERA_SETUP.md             # Hedera setup
│   └── SPARK_IMPLEMENTATION_PLAN.md # Implementation plan
└── hardhat.config.ts               # Hardhat configuration
```

## Smart Contracts

### SPARKController

**Location**: `contracts/SPARKController.sol`

Main contract managing SPARK token operations and production tracking.

**Key Functions**:

- `recordProductionAndMint(address producer, uint256 kwh, uint256 deadline, bytes signature)`: Record production and mint with signature verification
- `burnTokens(uint256 amount)`: Burn tokens
- `getTotalProduction(address producer)`: Query total production
- `getProductionRecords(address producer)`: Get production history
- `getDailyProduction(address producer, uint256 timestamp)`: Daily stats
- `getHourlyProduction(address producer, uint256 timestamp)`: Hourly stats

**Security Features**:

- ECDSA signature verification (ecrecover)
- Deadline-based replay protection
- Owner-only authorization
- Custom errors: `InvalidSignature`, `SignatureExpired`

See [SPARK_DEVELOPER.md](./docs/SPARK_DEVELOPER.md) for complete API reference.

## Documentation

📖 **[Documentation Index](./docs/DOCUMENTATION_INDEX.md)** - Complete guide to all documentation

### Getting Started

- 📘 [User Guide](./docs/SPARK_TOKEN.md) - How to use SPARK token
- ⚙️ [Hedera Setup](./docs/HEDERA_SETUP.md) - Account configuration
- 🚀 [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md) - Complete deployment walkthrough

### Technical Documentation

- 🔧 [Developer Guide](./docs/SPARK_DEVELOPER.md) - Technical details and API
- 🔐 [Signature Verification](./docs/SIGNATURE_VERIFICATION.md) - ECDSA signature system
- 🧪 [Testing Guide](./docs/TESTING_GUIDE.md) - Testing and troubleshooting

### Development

- 📋 [Implementation Plan](./SPARK_IMPLEMENTATION_PLAN.md) - Development roadmap

## Network Configuration

### Hedera Testnet

- **Network**: Hedera Testnet
- **Explorer**: https://hashscan.io/testnet
- **Faucet**: https://portal.hedera.com/faucet
- **RPC**: https://testnet.hashio.io/api

### Ethereum Sepolia

- **Network**: Sepolia Testnet
- **RPC**: Via Alchemy
- **Explorer**: https://sepolia.etherscan.io/

See `hardhat.config.ts` for complete network configuration.

## Technology Stack

- **Hardhat 3.0.7**: Development environment
- **Solidity 0.8.28**: Smart contract language
- **Hedera SDK 2.75.0**: Hedera integration
- **Viem 2.30.0**: Ethereum library
- **TypeScript 5.9.3**: Type-safe scripting
- **Node:test**: Native testing framework

## Security

### Best Practices Applied

- ✅ Custom errors for gas efficiency
- ✅ Access control (owner-only operations)
- ✅ Input validation on all public functions
- ✅ Immutable variables where applicable
- ✅ Safe math (Solidity 0.8+)
- ✅ Event emission for all state changes
- ✅ Comprehensive test coverage

### Auditing

Run security checks:

```bash
npm run lint          # Solhint static analysis
npm run test          # Test suite
```

## Troubleshooting

### Common Issues

**INSUFFICIENT_TX_FEE**

- Cause: Not enough HBAR in account for transaction fees
- Solution: Get more testnet HBAR from [faucet](https://portal.hedera.com/faucet)

**CONTRACT_REVERT_EXECUTED during mint**

- Cause: Invalid signature, expired deadline, or supply key not transferred
- Solutions:
  - Verify supply key is held by contract: `npm run query:supply-key`
  - Check owner address matches signature signer
  - Ensure deadline hasn't expired (signatures valid for 1 hour)

**InvalidSignature error**

- Cause: Signature doesn't match contract owner
- Solution: Verify HEDERA_TESTNET_HEX_PRIVATE_KEY in .env matches contract owner
- Note: Owner is derived from private key, not from account ID conversion

**SignatureExpired error**

- Cause: Signature deadline has passed
- Solution: Generate new signature (automatically handled by mint script)

**Stack too deep compilation error**

- Cause: Complex contract exceeds EVM stack limit
- Solution: Already resolved with `viaIR: true` in hardhat.config.ts

**Contract compilation errors**

- Solution: Run `npm run clean && npm run compile`

**Test failures**

- Solution: Ensure all dependencies are installed: `npm install`

**Token not associated**

- Solution: Run `npm run associate:token`

**INSUFFICIENT_GAS**

- Cause: Transaction ran out of gas during execution
- Solution: Increase gas limit in script (already set to 2M for signature verification)

### Verification Commands

Check system state:

```bash
npm run query:supply-key    # Who holds the supply key?
npm run query:spark         # Token info and balances
npm run query:production    # Production records
```

### Testing Signature Verification

Test signature generation locally:

```bash
npm run test:signature      # Verify signature generation/verification
npm run test:keys           # Check which keys produce which addresses
```

See documentation for more troubleshooting tips.

## Contributing

1. Follow Solidity style guide
2. Add tests for new features
3. Update documentation
4. Run linter before committing
5. Ensure all tests pass

## Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Hedera Documentation](https://docs.hedera.com/)
- [Hedera Token Service](https://docs.hedera.com/hedera/sdks-and-apis/sdks/token-service)
- [Viem Documentation](https://viem.sh/)
- [HashScan Explorer](https://hashscan.io/)

## Support

For issues or questions:

- Check [documentation](./docs/)
- Review [implementation plan](./SPARK_IMPLEMENTATION_PLAN.md)
- Inspect transaction on [HashScan](https://hashscan.io/testnet)

---

**Part of the Autonomous Grid VPP System**
_Empowering renewable energy through blockchain technology_ ⚡🌱
