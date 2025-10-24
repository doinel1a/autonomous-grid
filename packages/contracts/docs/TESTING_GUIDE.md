# SPARK Token Testing Guide

Complete guide for testing the SPARK token system, from local validation to on-chain deployment.

## Table of Contents

- [Overview](#overview)
- [Test Types](#test-types)
- [Local Testing](#local-testing)
- [Testnet Testing](#testnet-testing)
- [Verification Commands](#verification-commands)
- [Common Test Scenarios](#common-test-scenarios)
- [Troubleshooting](#troubleshooting)
- [CI/CD Integration](#cicd-integration)

---

## Overview

The SPARK token system requires testing at multiple levels:

1. **Contract Compilation**: Ensure contracts compile without errors
2. **Unit Tests**: Test individual contract functions
3. **Signature Verification**: Verify signature generation and validation
4. **Key Derivation**: Ensure private keys produce correct addresses
5. **Integration Tests**: Test complete deployment and operation flow
6. **Testnet Deployment**: Validate on Hedera testnet

---

## Test Types

### 1. Compilation Tests

**Purpose**: Verify contracts compile successfully

**Command**:

```bash
npm run compile
```

**Expected Output**:

```
Compiled 5 Solidity files successfully (evm target: paris).
```

**What's Tested**:

- Solidity syntax correctness
- Import resolution
- viaIR compilation (for complex contracts)
- No "stack too deep" errors

**Common Issues**:

```bash
# If compilation fails:
npm run clean && npm run compile
```

---

### 2. Signature Verification Tests

**Purpose**: Verify signature generation and verification logic

**Script**: `scripts/hedera/test-signature.ts`

**Command**:

```bash
npm run test:signature
```

**What's Tested**:

- Signature generation with ethers.js
- Message hash creation (matches contract)
- Ethereum prefix handling
- Signature recovery (ecrecover simulation)
- Owner address matching

**Expected Output**:

```
🧪 Testing signature generation and verification...

📋 Parameters:
   Producer: 0x00000000000000000000000000000000006c72e0
   kWh: 10
   Deadline: 2025-01-24T11:00:00.000Z

🔑 Owner Address: 0xCd27a4898Bf3692dC5Dc2B6dF6fe59605eB5089e

⏳ Generating signature...
   Signature: 0x1234567890abcdef...

⏳ Verifying signature...
   Message Hash: 0xabcdef1234567890...
   Recovered Signer: 0xCd27a4898Bf3692dC5Dc2B6dF6fe59605eB5089e
   Expected Owner: 0xCd27a4898Bf3692dC5Dc2B6dF6fe59605eB5089e
   Match: ✅ YES

✅ Signature verification passed!
   The signature should work with the contract.
```

**Success Criteria**:

- ✅ Recovered signer matches expected owner
- ✅ Signature is 65 bytes (130 hex chars + "0x")
- ✅ No errors during signature generation

**Failure Indicators**:

- ❌ Recovered signer doesn't match owner
- ❌ Invalid signature length
- ❌ "invalid BytesLike value" error

---

### 3. Key Derivation Tests

**Purpose**: Verify private keys produce correct addresses

**Script**: `scripts/hedera/test-keys.ts`

**Command**:

```bash
npm run test:keys
```

**What's Tested**:

- HEDERA_TESTNET_HEX_PRIVATE_KEY (hex format) → EVM address
- HEDERA_DER_TESTNET_PRIVATE_KEY (DER format) → EVM address
- Both keys produce the same address

**Expected Output**:

```
🔑 Testing private keys...

Account ID: 0.0.7107296

📋 HEDERA_TESTNET_HEX_PRIVATE_KEY:
   Hex Key: 0xc86fc3b8...
   Address: 0xCd27a4898Bf3692dC5Dc2B6dF6fe59605eB5089e

📋 HEDERA_DER_TESTNET_PRIVATE_KEY (DER):
   DER Key: 302e020100300706...
   Hex Key: 0xc86fc3b8...
   Address: 0xCd27a4898Bf3692dC5Dc2B6dF6fe59605eB5089e

🎯 Expected owner address: 0x00000000000000000000000000000000006c72e0
```

**Success Criteria**:

- ✅ Both keys produce the same address
- ✅ Address is a valid EVM address (0x + 40 hex chars)
- ✅ You know which address will be contract owner

**Important**:
The "Expected owner address" at the bottom is from accountIdToAddress() conversion - this is **NOT** the correct owner for signature verification! Use the addresses from the private keys instead.

---

### 4. Unit Tests

**Purpose**: Test contract functions in isolation

**Location**: `test/SPARKController.test.ts`

**Command**:

```bash
npm run test
```

**What's Tested**:

- Constructor initialization
- Access control (owner-only functions)
- Production recording logic
- Token minting calculations
- Burn functionality
- Query functions
- Event emissions

**Test Structure**:

```typescript
describe('SPARKController', () => {
  describe('Deployment', () => {
    it('Should set the correct token address', async () => {
      // Test implementation
    });

    it('Should set the correct owner', async () => {
      // Test implementation
    });
  });

  describe('Production Recording', () => {
    it('Should record production with valid signature', async () => {
      // Test implementation
    });

    it('Should revert on invalid signature', async () => {
      // Test implementation
    });

    it('Should revert on expired signature', async () => {
      // Test implementation
    });
  });

  describe('Token Operations', () => {
    it('Should mint correct SPARK amount', async () => {
      // Test implementation
    });

    it('Should burn tokens correctly', async () => {
      // Test implementation
    });
  });
});
```

---

## Local Testing

### Setup Local Environment

```bash
# 1. Install dependencies
npm install

# 2. Compile contracts
npm run compile

# 3. Run type checking
npm run typecheck
```

### Run All Local Tests

```bash
# Run all tests
npm run test

# Run specific test file
npx hardhat test test/SPARKController.test.ts

# Run with verbose output
npx hardhat test --verbose
```

### Linting

```bash
# Check Solidity code style
npm run lint

# Auto-fix issues
npm run lint:fix
```

---

## Testnet Testing

### Phase 1: Pre-Deployment Tests

Before deploying to testnet, verify everything works locally:

```bash
# 1. Compilation
npm run compile

# 2. Signature verification
npm run test:signature

# 3. Key derivation
npm run test:keys

# 4. Unit tests (if available)
npm run test
```

**Checklist**:

- [ ] All contracts compile successfully
- [ ] Signature verification passes
- [ ] Private keys produce expected addresses
- [ ] .env file configured correctly

---

### Phase 2: Testnet Deployment

Step-by-step deployment with verification at each stage.

#### Step 2.1: Token Creation

```bash
npm run create:spark
```

**Verify**:

```bash
npm run query:spark
```

**Expected**:

- Token ID populated in .env
- Token name: "SPARK"
- Token symbol: "SPRK"
- Decimals: 8
- Total supply: 0
- Treasury: Your account

**Success Criteria**:

- ✅ Token visible on HashScan
- ✅ TESTNET_SPARK_TOKEN_ID in .env
- ✅ Zero initial supply

---

#### Step 2.2: Controller Deployment

```bash
npm run deploy:controller:testnet
```

**Verify**:

```bash
# Check contract address
echo $TESTNET_SPARK_CONTROLLER_ADDRESS

# Verify owner matches private key
npm run test:keys
```

**Expected**:

- Contract ID populated in .env
- Owner address matches HEDERA_TESTNET_HEX_PRIVATE_KEY
- Contract visible on HashScan

**Success Criteria**:

- ✅ Contract deployed successfully
- ✅ TESTNET_SPARK_CONTROLLER_ADDRESS in .env
- ✅ Owner address correct

**Critical Check**:

```bash
# Contract owner should match this:
npm run test:keys
# Look for address under "HEDERA_TESTNET_HEX_PRIVATE_KEY"
```

---

#### Step 2.3: Supply Key Transfer

```bash
npm run transfer:supply-key
```

**Verify**:

```bash
npm run query:supply-key
```

**Expected Output**:

```
Supply Key Holder: Contract (0.0.7121955)
```

**Success Criteria**:

- ✅ Supply key held by contract (not your account)
- ✅ Transaction confirmed on HashScan

**Warning Check**:

```bash
# If this shows your account, transfer failed:
npm run query:supply-key

# Expected: Contract (0.0.xxxxx)
# Not expected: Your account (0.0.xxxxx)
```

---

#### Step 2.4: Contract Funding

```bash
npm run fund:contract
```

**Verify**:

```bash
npm run query:spark
# Look for "Contract Balance" section
```

**Expected**:

- Contract balance: ~10 HBAR

**Success Criteria**:

- ✅ Contract has HBAR for operations
- ✅ Balance visible in query

---

### Phase 3: Functional Testing

#### Test 3.1: First Mint

```bash
# Mint 10 kWh (10,000 SPARK)
npm run mint:spark
```

**Expected Output**:

```
✅ Production recorded and tokens minted successfully!

Transaction Details:
   Producer: 0.0.7107296
   Energy Produced: 10 kWh
   SPARK Minted: 10000 SPARK

Treasury SPARK Balance: 10000 SPARK
Energy Equivalent: 10 kWh
```

**Verify**:

```bash
npm run query:spark
# Check total supply increased to 10,000 SPARK

npm run query:production
# Check production record exists
```

**Success Criteria**:

- ✅ Transaction succeeds
- ✅ Total supply increases by 10,000 SPARK
- ✅ Production record created
- ✅ Event emitted

**Common Failures**:

- ❌ InvalidSignature: Owner address mismatch
- ❌ SignatureExpired: Deadline passed (rare)
- ❌ CONTRACT_REVERT: Supply key not transferred

---

#### Test 3.2: Multiple Mints

```bash
# Mint 5 kWh
KWH_AMOUNT="5" npm run mint:spark

# Wait a few seconds

# Mint 15 kWh
KWH_AMOUNT="15" npm run mint:spark
```

**Verify**:

```bash
npm run query:production
```

**Expected**:

- Total supply: 30,000 SPARK (10 + 5 + 15)
- Multiple production records
- Hourly/daily aggregates updated

---

#### Test 3.3: Production Queries

```bash
npm run query:production
```

**Expected Output**:

```
📊 Production Records for 0.0.7107296:

Individual Records (3):
  2025-01-24 10:00 - 10 kWh → 10000 SPARK
  2025-01-24 10:15 - 5 kWh → 5000 SPARK
  2025-01-24 10:30 - 15 kWh → 15000 SPARK

Hourly Aggregates:
  2025-01-24 10:00 - 30 kWh (3 records)

Daily Aggregates:
  2025-01-24 - 30 kWh (3 records)

Total Production: 30 kWh (30000 SPARK)
```

---

#### Test 3.4: Token Burning

```bash
# Burn 1,000 SPARK
BURN_AMOUNT="1000" npm run burn:spark
```

**Verify**:

```bash
npm run query:spark
```

**Expected**:

- Total supply decreased by 1,000 SPARK
- Treasury balance decreased by 1,000 SPARK

---

### Phase 4: Edge Case Testing

#### Test 4.1: Expired Signature

```bash
# Manual test - modify mint-spark.ts temporarily:
const deadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour in the past

npm run mint:spark
```

**Expected**:

- ❌ Transaction reverts with "SignatureExpired"

**Reset**:

```bash
# Change back to:
const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour in the future
```

---

#### Test 4.2: Invalid Producer Address

```bash
# Invalid address
PRODUCER_ADDRESS="0x0000000000000000000000000000000000000000" npm run mint:spark
```

**Expected**:

- May succeed (zero address is technically valid)
- But production recorded for zero address (not useful)

**Best Practice**: Validate addresses off-chain before minting

---

#### Test 4.3: Zero kWh

```bash
KWH_AMOUNT="0" npm run mint:spark
```

**Expected**:

- ❌ Transaction reverts with "InvalidAmount" (if validation added)
- OR succeeds but mints 0 SPARK (not useful)

---

#### Test 4.4: Large Amount

```bash
# Test uint64 limit (184,467,440 SPARK max with 8 decimals)
KWH_AMOUNT="184467440" npm run mint:spark
```

**Expected**:

- ✅ Should succeed (within uint64 limit)

```bash
# Test beyond limit
KWH_AMOUNT="200000000" npm run mint:spark
```

**Expected**:

- ❌ May overflow or revert (depending on HTS behavior)

---

## Verification Commands

### Quick Health Check

Run these commands to verify system state:

```bash
# 1. Token info
npm run query:spark

# 2. Supply key holder
npm run query:supply-key

# 3. Production records
npm run query:production

# 4. Signature verification
npm run test:signature

# 5. Key addresses
npm run test:keys
```

### Detailed State Verification

```bash
# Check token on HashScan (replace TOKEN_ID)
https://hashscan.io/testnet/token/0.0.7121813

# Check contract on HashScan (replace CONTRACT_ID)
https://hashscan.io/testnet/contract/0.0.7121955

# Check transaction (replace TRANSACTION_ID)
https://hashscan.io/testnet/transaction/0.0.7107296@1761313199.737994428
```

---

## Common Test Scenarios

### Scenario 1: Fresh Deployment Test

Complete flow from scratch:

```bash
# 1. Setup
npm install
npm run compile

# 2. Verify signatures work
npm run test:signature
npm run test:keys

# 3. Deploy
npm run create:spark
npm run deploy:controller:testnet
npm run transfer:supply-key
npm run fund:contract

# 4. Test minting
npm run mint:spark

# 5. Verify
npm run query:spark
npm run query:production
```

---

### Scenario 2: Signature Verification Test

Test that signatures are generated and verified correctly:

```bash
# 1. Test signature locally
npm run test:signature
# Expected: ✅ YES

# 2. Test on-chain
npm run mint:spark
# Expected: ✅ Success

# 3. Check owner address matches
npm run test:keys
# Compare with deployment output
```

---

### Scenario 3: Production Tracking Test

Verify production records are stored correctly:

```bash
# 1. Mint multiple times
npm run mint:spark
sleep 5
KWH_AMOUNT="5" npm run mint:spark
sleep 5
KWH_AMOUNT="15" npm run mint:spark

# 2. Check records
npm run query:production

# Expected:
# - 3 individual records
# - Hourly aggregate (sum of all in same hour)
# - Daily aggregate (sum of all in same day)
# - Total production (sum of all)
```

---

### Scenario 4: Recovery Test

Test recovery from common issues:

```bash
# Scenario: Supply key not transferred
npm run mint:spark
# ❌ Fails with CONTRACT_REVERT

# Fix:
npm run query:supply-key  # Verify issue
npm run transfer:supply-key  # Transfer key
npm run mint:spark  # Try again
# ✅ Success

# Scenario: Owner address mismatch
npm run mint:spark
# ❌ Fails with InvalidSignature

# Fix:
npm run test:keys  # Check correct owner
npm run deploy:controller:testnet  # Redeploy with correct owner
npm run transfer:supply-key  # Transfer key again
npm run mint:spark  # Try again
# ✅ Success
```

---

## Troubleshooting

### Issue 1: InvalidSignature

**Symptoms**:

- Mint fails with CONTRACT_REVERT_EXECUTED
- No specific error message (or InvalidSignature if shown)

**Diagnosis**:

```bash
# 1. Check owner address
npm run test:keys

# 2. Compare with contract deployment output
# Look for "Owner: 0x..." in deployment logs

# 3. Test signature locally
npm run test:signature
```

**Solution**:

```bash
# If owner doesn't match private key:
npm run deploy:controller:testnet  # Redeploy
npm run transfer:supply-key  # Transfer supply key again
npm run fund:contract  # Fund contract again
npm run mint:spark  # Test mint
```

---

### Issue 2: SignatureExpired

**Symptoms**:

- Transaction reverts with "SignatureExpired"

**Diagnosis**:

```bash
# Check system time
date

# Signature deadlines are 1 hour from generation
# If system time is wrong, signatures may expire immediately
```

**Solution**:

```bash
# Simply run mint again (generates new signature)
npm run mint:spark
```

---

### Issue 3: Supply Key Not Transferred

**Symptoms**:

- Mint fails with CONTRACT_REVERT_EXECUTED
- No specific signature error

**Diagnosis**:

```bash
npm run query:supply-key
```

**Expected**: "Contract (0.0.xxxxx)"
**Problem**: "Your account (0.0.xxxxx)"

**Solution**:

```bash
npm run transfer:supply-key
npm run query:supply-key  # Verify
npm run mint:spark  # Try again
```

---

### Issue 4: Compilation Errors

**Symptoms**:

- "Stack too deep" error
- Compilation fails

**Solution**:

```bash
# Clean and recompile
npm run clean
npm run compile

# If still fails, check hardhat.config.ts has:
# viaIR: true
```

---

### Issue 5: INSUFFICIENT_TX_FEE

**Symptoms**:

- Transaction fails with INSUFFICIENT_TX_FEE
- During deployment or mint

**Diagnosis**:

```bash
# Check account balance (on HashScan)
# Or query in script

# Check contract balance
npm run query:spark
```

**Solution**:

```bash
# For account:
# Get testnet HBAR: https://portal.hedera.com/faucet

# For contract:
npm run fund:contract
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test SPARK Contracts

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install
        working-directory: packages/contracts

      - name: Compile contracts
        run: npm run compile
        working-directory: packages/contracts

      - name: Run linter
        run: npm run lint
        working-directory: packages/contracts

      - name: Type check
        run: npm run typecheck
        working-directory: packages/contracts

      - name: Run tests
        run: npm run test
        working-directory: packages/contracts
```

---

## Test Checklist

### Pre-Deployment

- [ ] Contracts compile without errors
- [ ] Linting passes
- [ ] Type checking passes
- [ ] Signature verification test passes
- [ ] Key derivation test passes
- [ ] .env configured correctly

### Deployment

- [ ] Token created successfully
- [ ] Contract deployed successfully
- [ ] Owner address correct (matches private key)
- [ ] Supply key transferred to contract
- [ ] Contract funded with HBAR

### Post-Deployment

- [ ] First mint succeeds
- [ ] Production record created
- [ ] Total supply increases correctly
- [ ] Token burning works
- [ ] Queries return correct data
- [ ] Events emitted properly

### Production Readiness

- [ ] All tests pass
- [ ] Signature verification working
- [ ] Production tracking accurate
- [ ] No unauthorized access possible
- [ ] Error handling tested
- [ ] Edge cases validated

---

## Summary

Key testing commands:

```bash
# Local Tests
npm run compile          # Compilation
npm run lint             # Code quality
npm run test             # Unit tests
npm run test:signature   # Signature verification
npm run test:keys        # Key derivation

# Deployment Tests
npm run create:spark     # Token creation
npm run deploy:controller:testnet  # Contract deployment
npm run transfer:supply-key  # Privilege transfer
npm run fund:contract    # Contract funding

# Functional Tests
npm run mint:spark       # Minting
npm run burn:spark       # Burning
npm run query:spark      # Token queries
npm run query:production # Production queries
npm run query:supply-key # Supply key verification
```

**Golden Rule**: Always test signature verification locally before deploying to testnet!

```bash
npm run test:signature && npm run test:keys
```

If these pass, on-chain operations should work correctly.
