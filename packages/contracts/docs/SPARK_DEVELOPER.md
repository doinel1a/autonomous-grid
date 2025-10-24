# SPARK Token - Developer Guide

## Architecture Overview

The SPARK token system consists of two main components:

1. **SPARK Token (HTS)**: Native Hedera fungible token
2. **SPARKController Contract**: Smart contract for production tracking and token management

```
┌─────────────────────────────────────────────────────────┐
│                     SPARK Ecosystem                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐         ┌─────────────────────────┐  │
│  │  SPARK Token │◄────────┤  SPARKController        │  │
│  │  (HTS Native)│         │  (Smart Contract)        │  │
│  └──────────────┘         └─────────────────────────┘  │
│       ▲                            │                     │
│       │                            │                     │
│       │                            ▼                     │
│       │                   ┌─────────────────┐           │
│       └───────────────────┤  HTS Precompile │           │
│                           │  (0x167)         │           │
│                           └─────────────────┘           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Smart Contract Architecture

### SPARKController.sol

**Location**: `contracts/SPARKController.sol`

#### State Variables

```solidity
// Constants
address constant HTS_PRECOMPILE = 0x0000000000000000000000000000000000000167;
int32 constant HTS_SUCCESS = 22;
uint256 public constant SPARK_PER_KWH = 1000;

// Immutable
address public immutable SPARK_TOKEN_ADDRESS;

// Mutable
address public owner;
ProductionRecord[] public allProductionRecords;
mapping(address => ProductionRecord[]) public producerRecords;
mapping(address => uint256) public producerTotalProduction;
mapping(address => mapping(uint256 => HourlyAggregate)) public hourlyAggregates;
mapping(address => mapping(uint256 => DailyAggregate)) public dailyAggregates;
```

#### Data Structures

```solidity
struct ProductionRecord {
  address producer; // Producer address
  uint256 amount; // Amount in SPARK tokens
  uint256 timestamp; // Block timestamp
}

struct HourlyAggregate {
  uint256 totalAmount; // Total SPARK in this hour
  uint256 recordCount; // Number of records
}

struct DailyAggregate {
  uint256 totalAmount; // Total SPARK in this day
  uint256 recordCount; // Number of records
}
```

#### Core Functions

##### Administrative

```solidity
constructor(address _sparkTokenAddress)
function transferOwnership(address newOwner) external onlyOwner
```

##### Production & Minting

```solidity
function recordProductionAndMint(address producer, uint256 kwh) external onlyOwner
function batchRecordProduction(address[] calldata producers, uint256[] calldata kwhAmounts) external onlyOwner
```

##### Burning

```solidity
function burnTokens(uint256 amount) external onlyOwner
```

##### Query Functions (View)

```solidity
function getTotalProduction(address producer) external view returns (uint256)
function getTotalProductionInWh(address producer) external view returns (uint256)
function getTotalProductionInkWh(address producer) external view returns (uint256)
function getProductionRecords(address producer) external view returns (ProductionRecord[] memory)
function getProductionRecordsPaginated(address producer, uint256 offset, uint256 limit) external view returns (ProductionRecord[] memory)
function getDailyProduction(address producer, uint256 timestamp) external view returns (uint256 amount, uint256 count)
function getHourlyProduction(address producer, uint256 timestamp) external view returns (uint256 amount, uint256 count)
function getProductionInRange(address producer, uint256 startTime, uint256 endTime) external view returns (uint256)
function getTotalRecordsCount() external view returns (uint256)
function getUserRecordsCount(address producer) external view returns (uint256)
function getGlobalRecord(uint256 recordId) external view returns (ProductionRecord memory)
```

##### Utility Functions

```solidity
function sparkToKwh(uint256 sparkAmount) public pure returns (uint256)
function kwhToSpark(uint256 kwh) public pure returns (uint256)
```

#### Events

```solidity
event ProductionRecorded(
  address indexed producer,
  uint256 amount,
  uint256 kwh,
  uint256 timestamp,
  uint256 indexed recordId
);

event TokensMinted(address indexed to, uint256 amount, uint256 timestamp);
event TokensBurned(address indexed from, uint256 amount, uint256 timestamp);
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

#### Custom Errors

```solidity
error UnauthorizedAccess();
error InvalidAmount();
error InvalidAddress();
error TokenOperationFailed(int32 responseCode);
error InvalidArrayLength();
```

## Hedera Integration

### HTS Precompile

The contract interacts with Hedera Token Service through a precompiled contract at address `0x0000000000000000000000000000000000000167`.

#### Mint Operation

```solidity
function _mintTokens(uint256 amount) internal {
  IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);

  bytes[] memory metadata;
  (int32 responseCode, , ) = hts.mintToken(SPARK_TOKEN_ADDRESS, uint64(amount), metadata);

  if (responseCode != HTS_SUCCESS) {
    revert TokenOperationFailed(responseCode);
  }
}
```

#### Burn Operation

```solidity
function _burnTokens(uint256 amount) internal {
  IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);

  int64[] memory serialNumbers;
  (int32 responseCode, ) = hts.burnToken(SPARK_TOKEN_ADDRESS, uint64(amount), serialNumbers);

  if (responseCode != HTS_SUCCESS) {
    revert TokenOperationFailed(responseCode);
  }
}
```

### Address Conversion

Hedera uses account IDs (0.0.xxxxx) while Solidity uses EVM addresses. Conversion is required:

```typescript
function accountIdToAddress(accountId: string): string {
  const parts = accountId.split('.');
  const accountNum = parseInt(parts[2]);
  const hexNum = accountNum.toString(16).padStart(16, '0');
  return `0x${'00000000'}${'00000000'}${hexNum}`;
}
```

## Deployment Process

### 1. Token Creation

**Script**: `scripts/hedera/create-spark-token.ts`

```typescript
const tokenCreateTx = await new TokenCreateTransaction()
  .setTokenName('SPARK')
  .setTokenSymbol('SPRK')
  .setDecimals(8)
  .setInitialSupply(0)
  .setTreasuryAccountId(accountId)
  .setTokenType(TokenType.FungibleCommon)
  .setSupplyType(TokenSupplyType.Infinite)
  .setAdminKey(privateKey.publicKey)
  .setSupplyKey(privateKey.publicKey)
  .execute(client);
```

### 2. Contract Deployment

**Script**: `scripts/hedera/deploy-spark-controller.ts`

```typescript
const contractCreateTx = new ContractCreateFlow()
  .setBytecode(contractBytecode)
  .setGas(150000)
  .setConstructorParameters(new ContractFunctionParameters().addAddress(tokenAddress))
  .execute(client);
```

### 3. Token Association

On Hedera, accounts/contracts must associate tokens before receiving them. This happens automatically during first mint, or can be done explicitly.

## Testing

### Unit Tests

**Location**: `test/SPARKController.test.ts`

Run tests:

```bash
npm run test
```

#### Test Coverage

- ✅ Deployment and initialization
- ✅ Constants verification
- ✅ Utility functions (conversions)
- ✅ Query functions with no data
- ✅ State management
- ✅ Edge cases

#### Integration Testing

Integration tests require actual Hedera testnet:

```typescript
// Deploy to testnet
npm run deploy:controller:testnet

// Test mint operation
PRODUCER_ADDRESS="0.0.12345" KWH_AMOUNT="10" npm run mint:spark

// Verify
npm run query:production
```

## Gas Optimization

### Applied Optimizations

1. **Custom Errors**: Instead of require strings

   ```solidity
   // ❌ Old way
   require(msg.sender == owner, "Not owner");

   // ✅ Optimized
   if (msg.sender != owner) revert UnauthorizedAccess();
   ```

2. **Immutable Variables**: For values set once

   ```solidity
   address public immutable SPARK_TOKEN_ADDRESS;
   ```

3. **Struct Packing**: Efficient storage layout

   ```solidity
   struct ProductionRecord {
     address producer; // 20 bytes
     uint256 amount; // 32 bytes
     uint256 timestamp; // 32 bytes
   }
   // Total: 84 bytes (3 slots)
   ```

4. **Batch Operations**: Process multiple items in one transaction

   ```solidity
   function batchRecordProduction(
       address[] calldata producers,
       uint256[] calldata kwhAmounts
   ) external onlyOwner
   ```

5. **Precomputed Aggregates**: Store aggregates instead of computing on-demand
   ```solidity
   mapping(address => mapping(uint256 => HourlyAggregate)) public hourlyAggregates;
   mapping(address => mapping(uint256 => DailyAggregate)) public dailyAggregates;
   ```

### Gas Costs (Approximate)

| Operation                          | Gas Cost | HBAR Cost (testnet) |
| ---------------------------------- | -------- | ------------------- |
| recordProductionAndMint            | ~500k    | ~$0.05              |
| burnTokens                         | ~300k    | ~$0.03              |
| batchRecordProduction (10 records) | ~2M      | ~$0.20              |
| Query functions                    | 0 (view) | Free                |

## Security Considerations

### Access Control

```solidity
modifier onlyOwner() {
    if (msg.sender != owner) revert UnauthorizedAccess();
    _;
}
```

All state-changing operations require owner privileges:

- Minting tokens
- Burning tokens
- Recording production
- Transferring ownership

### Input Validation

```solidity
modifier validAddress(address _address) {
    if (_address == address(0)) revert InvalidAddress();
    _;
}

modifier validAmount(uint256 _amount) {
    if (_amount == 0) revert InvalidAmount();
    _;
}
```

### Reentrancy

Not applicable - all external calls are to the trusted HTS precompile.

### Integer Overflow

Protected by Solidity 0.8+ automatic overflow checks.

## Extending the System

### Adding New Features

#### 1. Multi-Producer Minting

Allow producers to mint their own tokens:

```solidity
mapping(address => bool) public authorizedProducers;

function addProducer(address producer) external onlyOwner {
    authorizedProducers[producer] = true;
}

function recordMyProduction(uint256 kwh) external {
    require(authorizedProducers[msg.sender], "Not authorized");
    _recordAndMint(msg.sender, kwh);
}
```

#### 2. Carbon Credit Tracking

Link carbon credits to production:

```solidity
struct ProductionRecord {
  address producer;
  uint256 amount;
  uint256 timestamp;
  uint256 carbonCredits; // NEW
}
```

#### 3. Transfer Restrictions

Implement transfer hooks for compliance:

```solidity
function beforeTokenTransfer(address from, address to, uint256 amount) internal view {
  // KYC checks, limits, etc.
}
```

### Integration Examples

#### Frontend Integration

```typescript
import { Client, ContractExecuteTransaction } from '@hashgraph/sdk';

async function mintSpark(producer: string, kwh: number) {
  const client = Client.forTestnet();
  client.setOperator(accountId, privateKey);

  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(1000000)
    .setFunction(
      'recordProductionAndMint',
      new ContractFunctionParameters().addAddress(producer).addUint256(kwh)
    )
    .execute(client);

  const receipt = await tx.getReceipt(client);
  return receipt.status;
}
```

#### IoT Device Integration

```typescript
// Simulated solar panel reading
interface SolarReading {
  timestamp: number;
  kwhProduced: number;
  panelId: string;
}

async function processSolarData(reading: SolarReading) {
  // Convert reading to blockchain transaction
  await mintSpark(panelId, reading.kwhProduced);
}
```

## Troubleshooting

### Common Development Issues

#### Contract Compilation Errors

```bash
# Clean and recompile
npm run clean
npm run compile
```

#### Test Failures

```bash
# Run tests in verbose mode
npm run test -- --verbose

# Run specific test file
npx hardhat test test/SPARKController.test.ts
```

#### Deployment Issues

```bash
# Check bytecode exists
ls -la artifacts/contracts/SPARKController.sol/

# Verify .env configuration
cat .env | grep HEDERA
```

### Debugging Tips

1. **Use HashScan**: Inspect all transactions on [hashscan.io](https://hashscan.io/testnet)
2. **Check Response Codes**: HTS returns specific error codes
3. **Verify Gas Limits**: Increase if transactions fail
4. **Log Events**: Monitor contract events for debugging

## API Reference

### Complete Function Signatures

See `contracts/SPARKController.sol` for full NatSpec documentation.

Quick reference:

```solidity
// Admin
constructor(address _sparkTokenAddress)
transferOwnership(address newOwner)

// Operations
recordProductionAndMint(address producer, uint256 kwh)
batchRecordProduction(address[] producers, uint256[] kwhAmounts)
burnTokens(uint256 amount)

// Queries
getTotalProduction(address) → uint256
getTotalProductionInWh(address) → uint256
getProductionRecords(address) → ProductionRecord[]
getProductionRecordsPaginated(address, uint256, uint256) → ProductionRecord[]
getDailyProduction(address, uint256) → (uint256, uint256)
getHourlyProduction(address, uint256) → (uint256, uint256)
getProductionInRange(address, uint256, uint256) → uint256
getTotalRecordsCount() → uint256
getUserRecordsCount(address) → uint256

// Utils
sparkToKwh(uint256) → uint256
kwhToSpark(uint256) → uint256
```

## Best Practices

1. **Always test on testnet first**
2. **Use batch operations** for multiple records
3. **Implement proper error handling** in scripts
4. **Monitor gas costs** and optimize where needed
5. **Document all changes** and maintain version control
6. **Backup private keys** securely
7. **Use pagination** for large data queries
8. **Implement rate limiting** for production systems

## Contributing

When contributing to the SPARK system:

1. Follow Solidity style guide
2. Add comprehensive tests
3. Update documentation
4. Run linter: `npm run lint`
5. Ensure all tests pass: `npm run test`
6. Add NatSpec comments to all public functions

## Resources

- [Solidity Documentation](https://docs.soliditylang.org/)
- [Hedera Smart Contracts](https://docs.hedera.com/hedera/core-concepts/smart-contracts)
- [HTS Integration Guide](https://docs.hedera.com/hedera/tutorials/smart-contracts/hscs-workshop)
- [Hardhat Documentation](https://hardhat.org/docs)

---

**Happy Building!** 🚀
