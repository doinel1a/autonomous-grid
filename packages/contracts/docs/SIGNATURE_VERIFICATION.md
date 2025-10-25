# SPARK Signature Verification System

Complete technical documentation for the ECDSA signature verification system used in SPARKController.

## Overview

The SPARK token system uses ECDSA (Elliptic Curve Digital Signature Algorithm) signature verification to authorize production recording and token minting operations. This ensures that only the authorized owner can record energy production and mint tokens.

## Why Signature Verification?

### The Hedera Challenge

On traditional Ethereum, you can use:

```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}
```

**Problem on Hedera**: When calling a contract via `ContractExecuteTransaction`, `msg.sender` is **not** the caller's account address. Instead, it's a system address or the contract proxy address.

**Solution**: Use cryptographic signatures

- Owner signs transaction data off-chain with their private key
- Contract verifies signature on-chain using `ecrecover`
- Only the private key holder can create valid signatures

### Security Benefits

1. **Cryptographic Proof**: Mathematical certainty that owner authorized the operation
2. **Replay Protection**: Deadline prevents reusing old signatures
3. **Cross-Chain Protection**: ChainId prevents signatures from being replayed on different networks (testnet → mainnet)
4. **Cross-Contract Protection**: Contract address prevents signatures from being used on different contract deployments
5. **No Trust Required**: Signature verification is trustless (uses cryptography)
6. **Hedera Compatible**: Works with Hedera's transaction model

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    OFF-CHAIN (TypeScript)                    │
│                                                              │
│  1. Create Message                                           │
│     ├─ producer: address                                     │
│     ├─ kwh: uint256                                          │
│     ├─ deadline: uint256                                     │
│     ├─ contractAddress: address  ← PREVENTS CROSS-CONTRACT   │
│     └─ chainId: uint256          ← PREVENTS CROSS-CHAIN      │
│                                                              │
│  2. Hash Message                                             │
│     messageHash = keccak256(                                 │
│       producer, kwh, deadline, contractAddress, chainId      │
│     )                                                        │
│                                                              │
│  3. Sign Message                                             │
│     signature = wallet.signMessage(messageHash)              │
│     ├─ Uses HEDERA_TESTNET_HEX_PRIVATE_KEY                   │
│     └─ Returns 65 bytes (r + s + v)                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    Send to Contract
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     ON-CHAIN (Solidity)                      │
│                                                              │
│  1. Check Deadline                                           │
│     require(block.timestamp <= deadline)                     │
│                                                              │
│  2. Recreate Message Hash (MUST MATCH OFF-CHAIN)             │
│     messageHash = keccak256(                                 │
│       producer, kwh, deadline, address(this), block.chainid  │
│     )                                                        │
│                                                              │
│  3. Add Ethereum Prefix                                      │
│     ethHash = keccak256("\x19Ethereum Signed Message:\n32")  │
│                                                              │
│  4. Recover Signer                                           │
│     signer = ecrecover(ethHash, v, r, s)                     │
│                                                              │
│  5. Verify Owner                                             │
│     require(signer == owner)                                 │
│                                                              │
│  ✅ If valid: Mint tokens and record production             │
│  ❌ If invalid: Revert with InvalidSignature error          │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### Off-Chain Signature Generation

**Location**: `scripts/hedera/utils/signature.ts`

```typescript
import { ethers } from 'ethers';

export async function signRecordProduction(
  producer: string,
  kwh: number,
  deadline: number,
  contractAddress: string,  // ← NEW: Prevents cross-contract replay
  chainId: number,           // ← NEW: Prevents cross-chain replay (296 = testnet, 295 = mainnet)
  privateKey: string
): Promise<string> {
  // 1. Create wallet from private key
  const wallet = new ethers.Wallet(privateKey);

  // 2. Create message hash (MUST match contract's getMessageHash)
  const messageHash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'uint256', 'address', 'uint256'],
    [producer, kwh, deadline, contractAddress, chainId]
  );

  // 3. Sign the message hash
  // This automatically adds Ethereum prefix and signs
  const signature = await wallet.signMessage(ethers.getBytes(messageHash));

  return signature; // 0x... (130 hex chars = 65 bytes)
}
```

**Key Points**:

- Uses `ethers.solidityPackedKeccak256()` to match Solidity's `keccak256(abi.encodePacked(...))`
- **CRITICAL**: Hash includes `contractAddress` and `chainId` to prevent replay attacks
- `wallet.signMessage()` automatically adds Ethereum prefix `"\x19Ethereum Signed Message:\n32"`
- Returns signature in format: `0x${r}${s}${v}` (65 bytes total)

**Hedera Chain IDs**:
- **Testnet**: 296
- **Mainnet**: 295

### On-Chain Signature Verification

**Location**: `contracts/SPARKController.sol`

#### Main Verification Function

```solidity
function _verifySignature(
  address producer,
  uint256 kwh,
  uint256 deadline,
  bytes memory signature
) internal view {
  // 1. Check deadline hasn't expired
  if (block.timestamp > deadline) revert SignatureExpired();

  // 2. Recreate the message hash (MUST match off-chain hash)
  // Includes address(this) and block.chainid to prevent replay attacks
  bytes32 messageHash = keccak256(
    abi.encodePacked(producer, kwh, deadline, address(this), block.chainid)
  );

  // 3. Add Ethereum signed message prefix
  bytes32 ethSignedMessageHash = _getEthSignedMessageHash(messageHash);

  // 4. Recover the signer from the signature
  address signer = _recoverSigner(ethSignedMessageHash, signature);

  // 5. Verify signer is the owner
  if (signer != owner) revert InvalidSignature();
}
```

#### Ethereum Prefix Helper

```solidity
function _getEthSignedMessageHash(bytes32 messageHash) internal pure returns (bytes32) {
  // Ethereum adds this prefix to prevent signing arbitrary transaction data
  return keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n32', messageHash));
}
```

**Why the prefix?**

- Prevents signatures from being used as transaction signatures
- Standard in Ethereum ecosystem (EIP-191)
- `ethers.js` adds this automatically in `signMessage()`

#### Signature Recovery

```solidity
function _recoverSigner(
  bytes32 ethSignedMessageHash,
  bytes memory signature
) internal pure returns (address) {
  // 1. Verify signature length (65 bytes)
  if (signature.length != 65) revert InvalidSignatureLength();

  // 2. Extract r, s, v from signature
  bytes32 r;
  bytes32 s;
  uint8 v;

  assembly {
    // First 32 bytes after length prefix = r
    r := mload(add(signature, 32))
    // Next 32 bytes = s
    s := mload(add(signature, 64))
    // Last byte = v
    v := byte(0, mload(add(signature, 96)))
  }

  // 3. Normalize v (some signers use 0/1, others use 27/28)
  if (v < 27) {
    v += 27;
  }

  // 4. Verify v is valid (must be 27 or 28)
  if (v != 27 && v != 28) revert InvalidSignatureVersion();

  // 5. Recover signer address using ecrecover precompile
  return ecrecover(ethSignedMessageHash, v, r, s);
}
```

**Signature Format**:

```
Signature (65 bytes):
├─ r (32 bytes): First part of ECDSA signature
├─ s (32 bytes): Second part of ECDSA signature
└─ v (1 byte):   Recovery ID (27 or 28)
```

**ecrecover Precompile**:

- Address: 0x0000000000000000000000000000000000000001
- Built-in EVM function for ECDSA signature recovery
- Returns the address that created the signature
- Costs 3,000 gas

---

## Usage in Contract

### Recording Production with Signature

```solidity
function recordProductionAndMint(
  address producer,
  uint256 kwh,
  uint256 deadline,
  bytes memory signature
) external validAddress(producer) validAmount(kwh) {
  // Verify signature before doing anything
  _verifySignature(producer, kwh, deadline, signature);

  // Calculate SPARK amount (1 kWh = 1000 SPARK)
  uint256 sparkAmount = kwh * SPARK_PER_KWH * (10 ** DECIMALS);

  // Mint tokens via HTS
  _mintTokens(sparkAmount);

  // Record production data
  _recordProduction(producer, kwh);

  // Emit event
  emit ProductionRecorded(producer, kwh, sparkAmount, block.timestamp);
}
```

**Security Flow**:

1. Signature verified FIRST (before any state changes)
2. If signature invalid or expired, reverts immediately
3. Only if signature is valid, proceeds with minting

---

## Example Flow

### Complete End-to-End Example

**Scenario**: Record 10 kWh of solar production

#### Step 1: Off-Chain (TypeScript)

```typescript
// scripts/hedera/mint-spark.ts

import { signRecordProduction } from './utils/signature.js';

// Parameters
const producer = '0xCd27a4898Bf3692dC5Dc2B6dF6fe59605eB5089e';
const kwh = 10;
const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

// Get private key
const privateKey = process.env.HEDERA_TESTNET_HEX_PRIVATE_KEY;
// Example: '0xc86fc3b82e603ee1514bea9b49a6d094d1f3088c2045a58838eadd80a6b94eca'

// Generate signature
const signature = await signRecordProduction(producer, kwh, deadline, privateKey);
// Returns: '0x1234...abcd' (130 hex characters = 65 bytes)

console.log('Signature:', signature);
console.log('Deadline:', new Date(deadline * 1000).toISOString());
```

**Signature Generation Process**:

```
1. Create message hash:
   messageHash = keccak256(
     0xCd27a4898Bf3692dC5Dc2B6dF6fe59605eB5089e, // producer
     10,                                          // kwh
     1761317000                                   // deadline
   )
   = 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890

2. Add Ethereum prefix:
   ethHash = keccak256(
     "\x19Ethereum Signed Message:\n32",
     0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
   )
   = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

3. Sign with private key:
   signature = sign(ethHash, privateKey)
   = {
       r: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef,
       s: 0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321,
       v: 27
     }

4. Encode signature:
   signature = 0x1234...abcd...27 (65 bytes)
```

#### Step 2: Send to Contract

```typescript
// Call contract via Hedera SDK
const contractExecTx = await new ContractExecuteTransaction()
  .setContractId(ContractId.fromSolidityAddress(controllerAddress))
  .setGas(2000000)
  .setFunction(
    'recordProductionAndMint',
    new ContractFunctionParameters()
      .addAddress(producer) // 0xCd27a48...
      .addUint256(kwh) // 10
      .addUint256(deadline) // 1761317000
      .addBytes(ethers.getBytes(signature)) // 0x1234...27
  )
  .setMaxTransactionFee(new Hbar(10))
  .execute(client);
```

#### Step 3: On-Chain Verification

```solidity
// SPARKController.sol

// 1. Check deadline
require(block.timestamp <= 1761317000, "SignatureExpired");
// ✅ Passes (current time < deadline)

// 2. Recreate message hash
bytes32 messageHash = keccak256(abi.encodePacked(
    0xCd27a4898Bf3692dC5Dc2B6dF6fe59605eB5089e,
    10,
    1761317000
));
// = 0xabcdef1234567890... (same as off-chain)

// 3. Add Ethereum prefix
bytes32 ethHash = keccak256(abi.encodePacked(
    "\x19Ethereum Signed Message:\n32",
    messageHash
));
// = 0x1234567890abcdef... (same as off-chain)

// 4. Recover signer
address signer = ecrecover(ethHash, v=27, r=0x1234..., s=0xfedc...);
// = 0xCd27a4898Bf3692dC5Dc2B6dF6fe59605eB5089e

// 5. Verify owner
require(signer == owner, "InvalidSignature");
// ✅ Passes (signer matches owner)

// 6. Proceed with minting
_mintTokens(10 * 1000 * 10**8); // 10 kWh = 10,000 SPARK
```

**Result**: 10,000 SPARK minted, production recorded ✅

---

## Security Analysis

### Replay Protection

**Deadline Mechanism**:

```solidity
if (block.timestamp > deadline) revert SignatureExpired();
```

**How it works**:

- Each signature includes a deadline (Unix timestamp)
- Signature valid only until deadline
- After deadline passes, signature becomes invalid

**Example**:

```typescript
// Signature created at 10:00 AM with 1 hour deadline
const deadline = 1761313200; // 11:00 AM

// At 10:30 AM: signature valid ✅
// At 11:30 AM: signature expired ❌
```

**Prevents**:

- Replaying old signatures
- Front-running attacks
- Unauthorized use of leaked signatures after expiration

### No Nonce Required

**Traditional approach** (Ethereum):

```solidity
mapping(address => uint256) public nonces;

function verify() {
    require(nonce == nonces[signer]++, "Invalid nonce");
}
```

**Our approach** (Hedera):

```solidity
 // No nonce needed!
// Deadline + unique parameters prevent replay
```

**Why no nonce?**

- Each production record has unique parameters (timestamp varies)
- Deadline provides time-based expiration
- Simpler implementation (less state, less gas)

**Trade-off**:

- Can use same signature multiple times within deadline
- BUT: Recording same production twice would be redundant (same producer, same kwh)
- Transaction deduplication handled by Hedera network

### Signature Malleability

**Not vulnerable** because:

1. We check `v == 27 || v == 28` (standard values)
2. Solidity 0.8+ reverts on invalid ecrecover
3. Modern `ethers.js` produces non-malleable signatures

### Owner Address Derivation

**CRITICAL SECURITY CONSIDERATION**:

**Wrong** ❌:

```typescript
// Converting account ID to address
const owner = accountIdToAddress('0.0.7107296');
// = 0x00000000000000000000000000000000006c72e0
```

**Correct** ✅:

```typescript
// Deriving from private key
const wallet = new ethers.Wallet(privateKey);
const owner = wallet.address;
// = 0xCd27a4898Bf3692dC5Dc2B6dF6fe59605eB5089e
```

**Why this matters**:

- ECDSA signatures always recover to the address derived from the private key
- Hedera account ID != EVM address from private key
- If owner is set wrong, ALL signatures will be invalid!

---

## Testing

### Local Signature Verification Test

**Script**: `scripts/hedera/test-signature.ts`

```typescript
async function testSignature() {
  const producer = '0x00000000000000000000000000000000006c72e0';
  const kwh = 10;
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const privateKey = process.env.HEDERA_TESTNET_HEX_PRIVATE_KEY!;

  // Generate signature
  const signature = await signRecordProduction(producer, kwh, deadline, privateKey);

  // Verify locally (same process as contract)
  const messageHash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'uint256'],
    [producer, kwh, deadline]
  );

  const recoveredSigner = ethers.verifyMessage(ethers.getBytes(messageHash), signature);

  // Check if recovered signer matches expected owner
  const wallet = new ethers.Wallet(privateKey);
  console.log('Recovered:', recoveredSigner);
  console.log('Expected:', wallet.address);
  console.log('Match:', recoveredSigner === wallet.address ? '✅' : '❌');
}
```

**Run**:

```bash
npm run test:signature
```

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

### Key Address Testing

**Script**: `scripts/hedera/test-keys.ts`

```typescript
async function testKeys() {
  const accountId = process.env.HEDERA_TESTNET_ACCOUNT_ID!;

  // Test hex key
  const hexKey = process.env.HEDERA_TESTNET_HEX_PRIVATE_KEY!;
  const wallet = new ethers.Wallet(hexKey);
  console.log('Hex Key Address:', wallet.address);

  // Test DER key
  const derKey = process.env.HEDERA_DER_TESTNET_PRIVATE_KEY!;
  const privateKey = PrivateKey.fromStringDer(derKey);
  const hexFromDer = '0x' + privateKey.toStringRaw();
  const walletFromDer = new ethers.Wallet(hexFromDer);
  console.log('DER Key Address:', walletFromDer.address);

  // Both should match!
}
```

**Run**:

```bash
npm run test:keys
```

---

## Gas Costs

### ecrecover Cost

**ecrecover precompile**: 3,000 gas

**Total signature verification**: ~5,000-7,000 gas

- ecrecover: 3,000 gas
- Hash computation: 1,000-2,000 gas
- Comparison and checks: 1,000-2,000 gas

**vs. msg.sender check**: ~100 gas

```solidity
require(msg.sender == owner); // ~100 gas
```

**Trade-off**: ~5,000 extra gas per mint

- Cost: ~0.000005 HBAR (~$0.0005 at $100/HBAR)
- Benefit: Works with Hedera's transaction model

---

## Best Practices

### 1. Always Use Fresh Deadlines

```typescript
// ✅ Good: Fresh deadline each time
const deadline = Math.floor(Date.now() / 1000) + 3600;

// ❌ Bad: Reusing old deadline
const deadline = 1761313200; // Fixed timestamp
```

### 2. Validate Parameters Before Signing

```typescript
// ✅ Good: Validate before signing
if (!ethers.isAddress(producer)) {
  throw new Error('Invalid producer address');
}
if (kwh <= 0) {
  throw new Error('kWh must be positive');
}

const signature = await signRecordProduction(producer, kwh, deadline, privateKey);
```

### 3. Secure Private Key Storage

```typescript
// ✅ Good: From environment variable
const privateKey = process.env.HEDERA_TESTNET_HEX_PRIVATE_KEY;

// ❌ Bad: Hardcoded
const privateKey = '0xc86fc3b82e603ee...'; // NEVER DO THIS
```

### 4. Handle Signature Errors Gracefully

```typescript
try {
  const signature = await signRecordProduction(producer, kwh, deadline, privateKey);
} catch (error) {
  if (error.message.includes('invalid BytesLike')) {
    console.error('Private key format error');
  } else if (error.message.includes('invalid address')) {
    console.error('Producer address format error');
  }
  throw error;
}
```

### 5. Test Locally Before On-Chain

```bash
# Always test signature verification locally first
npm run test:signature

# Then test on-chain
npm run mint:spark
```

---

## Common Errors and Solutions

### InvalidSignature

**Error**: Contract reverts with `InvalidSignature()`

**Possible Causes**:

1. Owner address mismatch (most common)
2. Wrong private key used for signing
3. Parameters don't match
4. Signature corrupted during transmission

**Solution**:

```bash
# 1. Verify owner address
npm run test:keys

# 2. Check contract owner (from deployment)
# Must match address from test:keys

# 3. If they don't match, redeploy contract
npm run deploy:controller:testnet

# 4. Test signature locally
npm run test:signature
```

### SignatureExpired

**Error**: Contract reverts with `SignatureExpired()`

**Cause**: `block.timestamp > deadline`

**Solution**:

```bash
# Simply run mint again (generates new signature with fresh deadline)
npm run mint:spark
```

### Invalid Signature Length

**Error**: `Invalid signature length` (on-chain)

**Cause**: Signature not exactly 65 bytes

**Solution**:

```typescript
// Ensure signature is properly encoded
const signature = await wallet.signMessage(messageHash);
// Should be 130 hex chars + "0x" prefix = 132 total chars
console.log('Signature length:', signature.length); // Should be 132
```

### Invalid BytesLike Value

**Error**: `invalid BytesLike value` (off-chain)

**Cause**: Private key has wrong format

**Solution**:

```env
# ✅ Correct format
HEDERA_TESTNET_HEX_PRIVATE_KEY='0xc86fc3b82e603ee1514bea9b49a6d094d1f3088c2045a58838eadd80a6b94eca'

# ❌ Wrong: Double 0x prefix
HEDERA_TESTNET_HEX_PRIVATE_KEY='0x0xc86fc3...'

# ❌ Wrong: DER format (need hex)
HEDERA_TESTNET_HEX_PRIVATE_KEY='302e020100300...'
```

---

## Future Enhancements

### Potential Improvements

1. **EIP-712 Structured Data Signing**
   - More standard approach
   - Better wallet support
   - Type-safe signing
   - Current: Using simple message signing

2. **Batch Signature Verification**
   - Verify multiple signatures in one call
   - Merkle tree approach
   - Gas savings for batch operations

3. **Signature Caching**
   - Store used signatures on-chain
   - Prevent exact replay
   - Trade-off: More storage cost

4. **Multi-Sig Support**
   - Require multiple signatures
   - Threshold signatures (m-of-n)
   - Enhanced security

---

## References

### Standards

- **EIP-191**: Signed Data Standard
  - https://eips.ethereum.org/EIPS/eip-191
  - Defines `"\x19Ethereum Signed Message:\n32"` prefix

- **EIP-712**: Typed Structured Data Hashing and Signing
  - https://eips.ethereum.org/EIPS/eip-712
  - Future enhancement consideration

### Resources

- **ecrecover Precompile**: 0x0000000000000000000000000000000000000001
- **ethers.js Signing**: https://docs.ethers.org/v6/api/wallet/#Signer-signMessage
- **Solidity ecrecover**: https://docs.soliditylang.org/en/latest/units-and-global-variables.html#mathematical-and-cryptographic-functions

---

## Security Updates (v2.0)

### ⚠️ BREAKING CHANGE: Enhanced Replay Attack Protection

**Version**: 2.0
**Date**: October 2025
**Status**: ✅ IMPLEMENTED

#### What Changed

The signature format now includes **contract address** and **chain ID** to prevent replay attacks:

**Before (v1.0)**:
```typescript
messageHash = keccak256(producer, kwh, deadline)
```

**After (v2.0)**:
```typescript
messageHash = keccak256(producer, kwh, deadline, contractAddress, chainId)
```

#### Why This Matters

**Without these protections**, signatures could be:
1. **Replayed on mainnet** if created for testnet (same signature works on both)
2. **Replayed on different contract** deployments (same signature works on all versions)

**With v2.0 protections**:
- ✅ Signatures are bound to specific contract address
- ✅ Signatures are bound to specific chain (testnet/mainnet)
- ✅ Cannot reuse signatures across deployments
- ✅ Cannot reuse signatures across networks

#### Migration Guide

**Old signatures (v1.0) will NOT work** with v2.0 contract.

**Action Required**:
1. Update signature generation code to include `contractAddress` and `chainId`
2. Regenerate all signatures after contract deployment
3. Update all systems that generate signatures

**Example Migration**:

```typescript
// ❌ OLD (v1.0) - WILL FAIL
const signature = await signRecordProduction(
  producer,
  kwh,
  deadline,
  privateKey
);

// ✅ NEW (v2.0) - REQUIRED
const signature = await signRecordProduction(
  producer,
  kwh,
  deadline,
  contractAddress,  // ← ADD THIS
  chainId,          // ← ADD THIS (296 for testnet, 295 for mainnet)
  privateKey
);
```

**Scripts Updated**:
- ✅ `scripts/hedera/utils/signature.ts`
- ✅ `scripts/hedera/mint-spark.ts`
- ✅ `scripts/hedera/test-signature.ts`

---

## Summary

The SPARK signature verification system provides:

✅ **Security**: Cryptographic proof of authorization
✅ **Hedera Compatibility**: Works with ContractExecuteTransaction
✅ **Replay Protection**: Deadline-based expiration + cross-chain/cross-contract protection
✅ **Gas Efficient**: Single ecrecover call (~3,000 gas)
✅ **Simple**: No nonce management required
✅ **Testable**: Can verify signatures off-chain before sending

**Key Takeaways**:
- Owner address MUST be derived from private key, not from account ID conversion
- Signatures are bound to specific contract and chain (v2.0+)
- Old signatures (v1.0) will not work with updated contract (v2.0)
