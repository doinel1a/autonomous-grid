# SPARK Token Deployment Guide

Complete step-by-step guide for deploying the SPARK token system on Hedera.

## Overview

The SPARK token system consists of two main components:

1. **SPARK Token (HTS)**: A native Hedera fungible token
2. **SPARKController Contract**: A smart contract that manages minting, burning, and production tracking

Deployment follows a specific sequence to properly transfer privileges from your account to the contract.

## Prerequisites

### Required Accounts and Keys

1. **Hedera Account**: Testnet or mainnet account with HBAR for fees
2. **Private Keys**: Both DER and hex formats in `.env`

### Environment Setup

Create `.env` file with the following variables:

```env
# Network Configuration
HEDERA_NETWORK='testnet'  # or 'mainnet'

# Account Configuration
HEDERA_TESTNET_ACCOUNT_ID='0.0.xxxxx'  # Your Hedera account ID

# Private Keys
# DER format (for Hedera SDK operations)
HEDERA_DER_TESTNET_PRIVATE_KEY='302e...'

# Hex format (for signature generation)
HEDERA_TESTNET_HEX_PRIVATE_KEY='0xc86fc3...'

# Will be populated during deployment
TESTNET_SPARK_TOKEN_ID=''  # Populated after Phase 1
TESTNET_SPARK_CONTROLLER_ADDRESS=''  # Populated after Phase 2
```

### Get Testnet HBAR

Visit the [Hedera Portal Faucet](https://portal.hedera.com/faucet) to get free testnet HBAR.

Recommended: At least 20 HBAR (10 for deployment, 10 for contract operations)

## Deployment Phases

### Phase 1: Token Creation

**Objective**: Create the SPARK token on Hedera Token Service (HTS)

**Command**:

```bash
npm run create:spark
```

**What Happens**:

1. Creates a new fungible token with:
   - Name: "SPARK"
   - Symbol: "SPRK"
   - Decimals: 8
   - Supply Type: Infinite
   - Initial Supply: 0
2. Sets keys:
   - **Admin Key**: Your account (for emergency operations)
   - **Supply Key**: Your account (will be transferred to contract later)
3. Sets your account as treasury

**Expected Output**:

```
✅ SPARK token created successfully!

Token Details:
   Token ID: 0.0.7121813
   Name: SPARK
   Symbol: SPRK
   Decimals: 8
   Supply Type: INFINITE
   Treasury: 0.0.7107296
```

**Verification**:

```bash
npm run query:spark
```

Should show:

- Token ID populated in .env
- Zero total supply
- Your account as treasury

**What's Next**: Token is created but cannot be minted by contract yet (supply key is on your account).

---

### Phase 2: Controller Deployment

**Objective**: Deploy the SPARKController smart contract

**Command**:

```bash
npm run deploy:controller:testnet
```

**What Happens**:

1. Reads compiled contract bytecode from `artifacts/`
2. Converts token ID to EVM address format
3. Derives owner address from HEDERA_TESTNET_HEX_PRIVATE_KEY using ethers.js
4. Deploys contract with constructor parameters:
   - Token address (from token ID)
   - Owner address (from private key)
5. Updates .env with TESTNET_SPARK_CONTROLLER_ADDRESS

**Expected Output**:

```
✅ SPARKController deployed successfully!

Contract Details:
   Contract ID: 0.0.7121955
   Contract Address (EVM): 0x00000000000000000000000000000000006cac23
   Owner: 0xCd27a4898Bf3692dC5Dc2B6dF6fe59605eB5089e
   SPARK Token: 0.0.7121813
```

**Critical Details**:

- **Owner Address**: Must match the address derived from HEDERA_TESTNET_HEX_PRIVATE_KEY
- This is the address that will be allowed to sign production records
- Not the same as converting account ID to address!

**Verification**:

```bash
# Check contract was deployed
npm run query:spark

# Verify owner address matches private key
npm run test:keys
```

**What's Next**: Contract is deployed but cannot mint tokens yet (supply key still on your account).

---

### Phase 3: Supply Key Transfer

**Objective**: Transfer the token supply key from your account to the contract

**Command**:

```bash
npm run transfer:supply-key
```

**What Happens**:

1. Creates a TokenUpdateTransaction
2. Sets the new supply key to the contract's public key
3. Executes the transaction
4. **IRREVERSIBLE**: Once transferred, only the contract can mint/burn

**Expected Output**:

```
✅ Supply key transferred to contract successfully!

   Old Supply Key: Your Account (0.0.7107296)
   New Supply Key: Contract (0.0.7121955)
```

**Critical Warning**:

- This operation is **IRREVERSIBLE**
- After this, only the contract can mint and burn tokens
- Your account retains the admin key for emergencies
- Verify contract code before transferring!

**Verification**:

```bash
npm run query:supply-key
```

Should show:

```
Supply Key Holder: Contract (0.0.7121955)
```

**What's Next**: Contract can now mint tokens, but needs HBAR for transaction fees.

---

### Phase 4: Contract Funding

**Objective**: Send HBAR to the contract for transaction fees

**Command**:

```bash
npm run fund:contract
```

**What Happens**:

1. Transfers 10 HBAR from your account to the contract
2. Contract uses this HBAR to pay for HTS operations (mint/burn)

**Expected Output**:

```
✅ Contract funded successfully!

   Amount: 10 HBAR
   Contract Balance: 10 HBAR
```

**Recommended Amount**: 10 HBAR

- Each mint operation costs ~0.001-0.01 HBAR
- 10 HBAR allows for thousands of operations

**Verification**:

```bash
npm run query:spark
```

Should show contract balance.

**What's Next**: Contract is ready to mint tokens!

---

### Phase 5: Token Association (Optional)

**Objective**: Associate SPARK token with contract (if not auto-associated)

**Command**:

```bash
npm run associate:token
```

**When Needed**:

- Some HTS operations require explicit token association
- Usually auto-associated during first mint
- Run if you get "TOKEN_NOT_ASSOCIATED_TO_ACCOUNT" error

**Expected Output**:

```
✅ Token associated with contract successfully!
```

---

## Post-Deployment Verification

### Complete Verification Checklist

Run these commands to verify everything is set up correctly:

```bash
# 1. Check token info
npm run query:spark
# Should show: Token created, zero or low supply

# 2. Verify supply key holder
npm run query:supply-key
# Should show: Contract holds supply key

# 3. Verify owner address
npm run test:keys
# Should show: HEDERA_TESTNET_HEX_PRIVATE_KEY produces expected owner address

# 4. Test signature generation
npm run test:signature
# Should show: Signature verification passes
```

### Expected Final State

After all phases:

**Token (0.0.7121813)**:

- Decimals: 8
- Supply Type: Infinite
- Total Supply: 0 (or some test amount)
- Admin Key: Your account
- Supply Key: Contract
- Treasury: Your account

**Contract (0.0.7121955)**:

- Owner: 0xCd27a4898Bf3692dC5Dc2B6dF6fe59605eB5089e (from private key)
- HBAR Balance: ~10 HBAR
- Can mint/burn: Yes (has supply key)
- Can verify signatures: Yes (owner set correctly)

---

## Production Operations

### Minting SPARK Tokens

After deployment, you can mint tokens by recording production:

```bash
# Mint for your account (default)
npm run mint:spark

# Mint for specific producer
PRODUCER_ADDRESS="0.0.12345" KWH_AMOUNT="10" npm run mint:spark
```

**Process**:

1. Script generates ECDSA signature:
   - Message: keccak256(producer, kwh, deadline)
   - Signer: HEDERA_TESTNET_HEX_PRIVATE_KEY
   - Deadline: Current time + 1 hour
2. Calls `recordProductionAndMint(producer, kwh, deadline, signature)`
3. Contract verifies:
   - Signature is valid (ecrecover)
   - Signer matches owner
   - Deadline hasn't expired
4. If valid:
   - Mints SPARK tokens (kwh × 1000 × 10^8)
   - Records production data
   - Emits events

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

### Querying Production

```bash
npm run query:production
```

Shows:

- Individual production records
- Hourly aggregates
- Daily aggregates
- Total production per producer

### Burning Tokens

```bash
BURN_AMOUNT="1000" npm run burn:spark
```

Burns tokens from treasury account (for consumption tracking).

---

## Architecture Details

### Why 8 Decimals?

**Problem**: HTS `mintToken()` accepts `int64` (max: 9,223,372,036,854,775,807)

- With 18 decimals: Max mint = 0.009 SPARK per transaction
- With 8 decimals: Max mint = 184,467,440 SPARK per transaction

**Solution**: Use 8 decimals

- 1 kWh = 1000 SPARK = 100,000,000,000 smallest units
- Reasonable precision for energy tracking
- Allows large mints without hitting uint64 limit

### Signature Verification Flow

**Off-chain (mint script)**:

1. Generate message hash: `keccak256(abi.encodePacked(producer, kwh, deadline))`
2. Sign with ethers: `wallet.signMessage(messageHash)`
3. Get signature (65 bytes: r + s + v)

**On-chain (SPARKController)**:

1. Check deadline: `block.timestamp <= deadline`
2. Recreate message hash: `keccak256(abi.encodePacked(producer, kwh, deadline))`
3. Add Ethereum prefix: `"\x19Ethereum Signed Message:\n32" + messageHash`
4. Recover signer: `ecrecover(ethSignedMessageHash, v, r, s)`
5. Verify: `signer == owner`

### Owner Address Derivation

**CRITICAL**: Owner must be derived from private key, not account ID!

**Wrong** (produces 0x00000000...006c72e0):

```typescript
const ownerAddress = accountIdToAddress('0.0.7107296');
```

**Correct** (produces 0xCd27a48...089e):

```typescript
const wallet = new ethers.Wallet(privateKeyHex);
const ownerAddress = wallet.address;
```

**Why**:

- ECDSA signatures recover to EVM address from private key
- Hedera account ID conversion produces different address
- These two addresses are NOT the same!

### Permission Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 1: Token Creation                   │
│                                                              │
│  Token Keys:                                                 │
│  ├─ Admin Key:  Your Account (0.0.xxxxx)                    │
│  └─ Supply Key: Your Account (0.0.xxxxx) ← TEMPORARY        │
│                                                              │
│  Treasury: Your Account (0.0.xxxxx)                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  PHASE 2: Contract Deployment                │
│                                                              │
│  Contract Params:                                            │
│  ├─ Token Address: From Token ID                            │
│  └─ Owner Address: From HEDERA_TESTNET_HEX_PRIVATE_KEY          │
│                                                              │
│  Contract Cannot Mint Yet (supply key still on account)     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              PHASE 3: Supply Key Transfer ⚠️                 │
│                                                              │
│  Token Keys:                                                 │
│  ├─ Admin Key:  Your Account (0.0.xxxxx) ← RETAINED         │
│  └─ Supply Key: Contract (0.0.yyyyy) ← TRANSFERRED          │
│                                                              │
│  ⚠️ IRREVERSIBLE: Only contract can now mint/burn           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  PHASE 4: Contract Funding                   │
│                                                              │
│  Contract Balance: 10 HBAR                                   │
│  Used for: HTS operation fees (mint/burn)                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION READY ✅                       │
│                                                              │
│  Mint Operations:                                            │
│  1. Off-chain: Generate signature with private key          │
│  2. On-chain: Contract verifies signature                   │
│  3. Contract calls HTS.mintToken()                          │
│  4. Tokens minted to treasury                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### InvalidSignature Error

**Symptom**: CONTRACT_REVERT_EXECUTED when minting

**Cause**: Owner address mismatch

**Solution**:

```bash
# 1. Check which address your private key produces
npm run test:keys

# 2. Compare with contract owner (from deployment output)
# They must match!

# 3. If they don't match, redeploy contract:
npm run deploy:controller:testnet
```

### SignatureExpired Error

**Symptom**: Transaction reverts with "SignatureExpired"

**Cause**: Deadline has passed (signatures valid for 1 hour)

**Solution**: Run mint script again (generates new signature automatically)

### Supply Key Not Transferred

**Symptom**: CONTRACT_REVERT_EXECUTED during mint, no specific error

**Cause**: Supply key still on your account

**Solution**:

```bash
# 1. Check who holds supply key
npm run query:supply-key

# 2. If it's your account, transfer to contract
npm run transfer:supply-key

# 3. Verify
npm run query:supply-key
```

### Stack Too Deep Compilation

**Symptom**: "Stack too deep" during compilation

**Cause**: Complex contract with many variables

**Solution**: Already resolved in `hardhat.config.ts`:

```typescript
settings: {
  optimizer: { enabled: true, runs: 200 },
  viaIR: true  // ← Enables IR-based compilation
}
```

### Contract Out of HBAR

**Symptom**: INSUFFICIENT_TX_FEE when minting

**Cause**: Contract has no HBAR for transaction fees

**Solution**:

```bash
npm run fund:contract  # Send more HBAR
```

---

## Security Considerations

### Pre-Deployment Checklist

- [ ] Contract code reviewed and tested
- [ ] Test deployment on testnet completed
- [ ] All verification scripts pass
- [ ] Signature verification tested
- [ ] Understanding of irreversible supply key transfer
- [ ] Backup of all private keys
- [ ] Environment variables secured

### Production Deployment

For mainnet deployment:

1. Change `HEDERA_NETWORK='mainnet'` in `.env`
2. Use mainnet account with sufficient HBAR
3. Follow same deployment phases
4. Test with small amounts first
5. Verify all operations before large-scale use

### Key Management

- **Admin Key**: Keep on your account for emergency operations
- **Supply Key**: Transfer to contract (irreversible)
- **Private Keys**: Never share or commit to version control
- **Owner Address**: Must match signature signer

### Rate Limiting

Consider implementing rate limiting for production:

- Max tokens per hour
- Max production records per day
- Cooldown periods

(Note: Current implementation has no rate limits)

---

## Emergency Procedures

### If Contract Has Bug

**Admin Key Retained**: You can still:

- Pause token transfers (if pauseKey was set)
- Wipe accounts (if wipeKey was set)
- Update token metadata

**Cannot Do**:

- Reclaim supply key from contract
- Mint/burn without contract

**Recommendation**: Deploy new contract with fixed code, create new token

### If Keys Are Compromised

1. If **admin key** compromised:
   - Immediately update admin key (if possible)
   - Contact Hedera support

2. If **private key** (owner) compromised:
   - Cannot change contract owner
   - Must deploy new contract with new owner
   - Transfer remaining treasury to new system

---

## Next Steps

After successful deployment:

1. **Test thoroughly**:

   ```bash
   npm run mint:spark
   npm run query:production
   npm run burn:spark
   ```

2. **Monitor operations**:
   - View on [HashScan](https://hashscan.io/testnet)
   - Check transaction costs
   - Verify production records

3. **Integrate with frontend**:
   - See main project README for integration guide
   - Use React hooks for wallet connection
   - Display production data

4. **Plan for mainnet**:
   - Complete testnet validation
   - Prepare mainnet HBAR
   - Schedule deployment

---

## Reference Commands Summary

```bash
# Deployment (run in order)
npm run create:spark                    # Phase 1
npm run deploy:controller:testnet       # Phase 2
npm run transfer:supply-key             # Phase 3
npm run fund:contract                   # Phase 4
npm run associate:token                 # Phase 5 (optional)

# Verification
npm run query:spark                     # Token info
npm run query:supply-key                # Check supply key holder
npm run test:keys                       # Verify key/address mapping
npm run test:signature                  # Test signature verification

# Operations
npm run mint:spark                      # Mint tokens
npm run burn:spark                      # Burn tokens
npm run query:production                # View production data

# Development
npm run compile                         # Compile contracts
npm run test                            # Run tests
npm run clean                           # Clean artifacts
```

---

**Deployment Complete!** 🎉

Your SPARK token system is now ready for production use. Record solar energy production and tokenize it on Hedera!
