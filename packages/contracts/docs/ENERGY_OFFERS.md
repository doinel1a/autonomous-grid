# Energy Offers System - Complete Guide

## Overview

The Energy Offers system enables peer-to-peer energy trading within the Autonomous Grid VPP. Producers can create sell offers for their produced energy, and the VPP AI agent can match these offers with buyers.

**Key Features**:
- 💡 Producers create sell offers with custom pricing
- 🔒 Automatic balance locking to prevent double-spending
- 🤝 Full and partial offer matching
- 📊 Complete offer tracking and history
- ✅ Multi-status offer lifecycle management

---

## Table of Contents

- [Concepts](#concepts)
- [Offer Lifecycle](#offer-lifecycle)
- [Access Control](#access-control)
- [Creating Offers](#creating-offers)
- [Matching Offers](#matching-offers)
- [Cancelling Offers](#cancelling-offers)
- [Querying Offers](#querying-offers)
- [Balance Management](#balance-management)
- [Events](#events)
- [Security](#security)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Concepts

### What is an Energy Offer?

An energy offer is a sell proposal created by an energy producer. It specifies:
- **Amount**: Energy quantity in Wh (Watt-hours)
- **Price**: Cost in EUR per kWh (with 8 decimals precision)
- **Seller**: The producer's address
- **Status**: Current state (ACTIVE, CANCELLED, COMPLETED, PARTIALLY_FILLED)

### Offer Economics

```
Example Offer:
- Amount: 1000 Wh (1 kWh)
- Price: 15000000 (0.15 EUR/kWh with 8 decimals)
- Total Value: 0.15 EUR
```

### Locked Balance

When a producer creates an offer, the offered energy is **locked** in their virtual balance:

```
Virtual Balance: 5000 Wh
Locked Balance:  1000 Wh (in active offer)
Available Balance: 4000 Wh (can be used for new offers or transfers)
```

This prevents **double-spending**: the same energy cannot be offered twice.

---

## Offer Lifecycle

An offer progresses through different states:

```
┌──────────────┐
│              │
│  CREATED     │  Producer creates offer
│  (ACTIVE)    │  → Energy locked
│              │
└──────┬───────┘
       │
       ├──────────────────┬──────────────────┐
       │                  │                  │
       v                  v                  v
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│              │   │              │   │              │
│  CANCELLED   │   │  COMPLETED   │   │ PARTIALLY_   │
│              │   │              │   │   FILLED     │
│              │   │              │   │              │
└──────────────┘   └──────────────┘   └──────┬───────┘
                                              │
     Seller/Owner        Full Match           │ Partial Match
     cancels offer       → Energy             │ → New offer
                          transferred         │   created with
                                              │   remaining Wh
                                              v
                                       ┌──────────────┐
                                       │              │
                                       │  NEW OFFER   │
                                       │   (ACTIVE)   │
                                       │              │
                                       └──────────────┘
```

### Status Descriptions

| Status | Description | Energy Locked? | Can be Modified? |
|--------|-------------|----------------|------------------|
| **ACTIVE** | Offer is available for matching | ✅ Yes | ✅ Can cancel |
| **CANCELLED** | Offer was cancelled by seller/owner | ❌ No | ❌ Final state |
| **COMPLETED** | Offer fully matched and executed | ❌ No | ❌ Final state |
| **PARTIALLY_FILLED** | Offer partially matched, new offer created | ❌ No | ❌ Final state |

---

## Access Control

### Who Can Do What?

| Action | Producers | Contract Owner (VPP AI) | Anyone |
|--------|-----------|------------------------|--------|
| Create Offer | ✅ Yes (if registered) | ✅ Yes | ❌ No |
| Cancel Offer | ✅ Yes (own offers) | ✅ Yes (any offer) | ❌ No |
| Match Offer | ❌ No | ✅ Yes (only) | ❌ No |
| Query Offers | ✅ Yes | ✅ Yes | ✅ Yes |

### Producer Requirements

To create an offer, you must be a **registered producer**:

```solidity
// You must have produced energy at least once
producerTotalProduction[seller] > 0
```

**How to become a registered producer**:
```bash
npm run mint:spark  # Record your first production
```

---

## Creating Offers

### Function Signature

```solidity
function createEnergyOffer(
    uint256 amountWh,       // Amount in Wh
    uint256 pricePerKwh     // Price in EUR/kWh (8 decimals)
) external
```

### Requirements

1. ✅ Caller must be a registered producer
2. ✅ `amountWh` > 0
3. ✅ `pricePerKwh` > 0
4. ✅ Available balance >= `amountWh`

### Example: Create an Offer

```bash
# Create offer: Sell 1 kWh at 0.15 EUR/kWh
OFFER_AMOUNT_WH=1000 OFFER_PRICE_PER_KWH=15000000 npm run create:offer
```

**What happens**:
1. Contract verifies you're a registered producer
2. Converts Wh to SPARK tokens (1000 Wh = 100000000 SPARK)
3. Checks available balance (virtual - locked)
4. Locks the energy: `lockedBalance[seller] += sparkAmount`
5. Creates offer with unique ID
6. Stores in global and seller-specific arrays
7. Emits `OfferCreated` event

**Output**:
```
✅ Energy offer created successfully!

📊 Transaction Details:
   Transaction ID: 0.0.7107296@1761313199.737994428
   Status: SUCCESS
   Seller: 0.0.7107296
   Amount: 1000 Wh (1 kWh)
   Price: 0.15 EUR/kWh
```

### Price Calculation

```javascript
// Price with 8 decimals precision
0.15 EUR/kWh = 15000000 (8 decimals)
0.20 EUR/kWh = 20000000
0.10 EUR/kWh = 10000000

// Formula
priceWithDecimals = price * 10^8
```

---

## Matching Offers

### Function Signature

```solidity
function matchEnergyOffer(
    uint256 offerId,        // Offer ID to match
    address buyer,          // Buyer address
    uint256 amountWh        // Amount to match (can be partial)
) external onlyOwner
```

### Requirements

1. ✅ Caller must be contract owner (VPP AI)
2. ✅ Offer must exist and be ACTIVE
3. ✅ `amountWh` <= offer.amountWh
4. ✅ `buyer` != zero address

### Full Match Example

```bash
# Match entire offer (1000 Wh)
OFFER_ID=0 BUYER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=1000 npm run match:offer
```

**What happens**:
1. Validates offer is ACTIVE
2. Unlocks energy from seller: `lockedBalance[seller] -= 1000 Wh`
3. Transfers energy: `virtualBalance[seller] -= 1000 Wh`, `virtualBalance[buyer] += 1000 Wh`
4. Creates transaction record
5. Updates offer status to COMPLETED
6. Emits `OfferMatched` and `OfferCompleted` events

### Partial Match Example

```bash
# Match only 500 Wh out of 1000 Wh offer
OFFER_ID=0 BUYER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=500 npm run match:offer
```

**What happens**:
1. Validates offer is ACTIVE
2. Unlocks matched amount: `lockedBalance[seller] -= 500 Wh`
3. Transfers matched energy: `virtualBalance[seller] -= 500 Wh`, `virtualBalance[buyer] += 500 Wh`
4. Creates transaction record for 500 Wh
5. **Automatically creates new offer** with remaining 500 Wh at same price
6. Locks remaining energy: `lockedBalance[seller] += 500 Wh`
7. Updates original offer status to PARTIALLY_FILLED
8. Emits `OfferMatched`, `OfferCreated` (for new offer) events

**Output**:
```
✅ Energy offer matched successfully!

📊 Transaction Details:
   Offer ID: 0
   Buyer: 0.0.12345
   Matched Amount: 500 Wh (0.5 kWh)

💡 Note:
   - Partial match: New offer created with remaining 500 Wh
   - New Offer ID: 1
   - Energy transferred from seller to buyer
   - Transaction record created for audit trail
```

### Matching Flow Diagram

```
Original Offer: 1000 Wh @ 0.15 EUR/kWh
Match Request: 500 Wh

┌─────────────────────┐
│  Original Offer #0  │
│  Amount: 1000 Wh    │
│  Status: ACTIVE     │
└──────────┬──────────┘
           │
           │ Match 500 Wh
           v
┌──────────────────────────────────┐
│  Partial Match Processing        │
│  1. Unlock 500 Wh                │
│  2. Transfer 500 Wh to buyer     │
│  3. Lock remaining 500 Wh        │
│  4. Create new offer             │
└──────────┬──────────┬────────────┘
           │          │
           v          v
    ┌──────────┐  ┌──────────────┐
    │ Offer #0 │  │ Offer #1     │
    │ Status:  │  │ Amount: 500  │
    │PARTIALLY │  │ Status:      │
    │ FILLED   │  │ ACTIVE       │
    └──────────┘  └──────────────┘
```

---

## Cancelling Offers

### Function Signature

```solidity
function cancelEnergyOffer(
    uint256 offerId         // Offer ID to cancel
) external
```

### Requirements

1. ✅ Offer must exist
2. ✅ Offer must be ACTIVE
3. ✅ Caller must be seller OR contract owner

### Example

```bash
# Cancel offer #0
OFFER_ID=0 npm run cancel:offer
```

**What happens**:
1. Validates offer exists and is ACTIVE
2. Validates caller is seller or owner
3. Unlocks energy: `lockedBalance[seller] -= amountWh`
4. Updates offer status to CANCELLED
5. Updates seller's offer array
6. Emits `OfferCancelled` event

**Output**:
```
✅ Energy offer cancelled successfully!

📊 Transaction Details:
   Transaction ID: 0.0.7107296@1761313199.737994428
   Status: SUCCESS
   Offer ID: 0
   Caller: 0.0.7107296
```

---

## Querying Offers

### Available Queries

| Function | Description | Parameters |
|----------|-------------|------------|
| `getActiveOffers()` | All active offers (paginated) | offset, limit |
| `getOffersBySeller()` | Offers by specific seller | seller, offset, limit |
| `getAllOffers()` | Complete offer history | offset, limit |
| `getOfferById()` | Single offer details | offerId |
| `getActiveOffersCount()` | Total active offers | - |
| `getTotalOffersCount()` | Total offers ever created | - |
| `getSellerOffersCount()` | Offers count per seller | seller |

### Query Examples

#### 1. View All Active Offers

```bash
npm run query:offers
```

**Output**:
```
📊 Found 3 active offers:

--- Offer #1 ---
   Offer ID: 0
   Seller: 0x00000000000000000000000000000000006c72e0
   Amount: 1000 Wh (1 kWh)
   Price: 0.15 EUR/kWh (15000000 smallest units)
   Timestamp: 2025-01-25T10:00:00.000Z
   Status: ACTIVE

--- Offer #2 ---
   Offer ID: 1
   Seller: 0x00000000000000000000000000000000006c72e0
   Amount: 500 Wh (0.5 kWh)
   Price: 0.15 EUR/kWh (15000000 smallest units)
   Timestamp: 2025-01-25T10:15:00.000Z
   Status: ACTIVE

📈 Offer Statistics:
   Total Offers: 5
   Active Offers: 3
```

#### 2. View Offers by Seller

```bash
QUERY_TYPE=seller SELLER_ADDRESS=0.0.7107296 npm run query:offers
```

#### 3. View All Offers (History)

```bash
QUERY_TYPE=all npm run query:offers
```

#### 4. View Specific Offer

```bash
OFFER_ID=0 npm run query:offers
```

#### 5. Paginated Queries

```bash
# Get offers 10-20
OFFSET=10 LIMIT=10 npm run query:offers
```

---

## Balance Management

### Balance Types

```
Total Virtual Balance = All energy credits owned
Locked Balance = Energy in active offers
Available Balance = Virtual - Locked
```

### Query Balance Functions

| Function | Description | Unit |
|----------|-------------|------|
| `getVirtualBalance(user)` | Total energy credits | SPARK (smallest units) |
| `getLockedBalance(user)` | Energy locked in offers | SPARK |
| `getAvailableBalance(user)` | Energy available for use | SPARK |
| `getVirtualBalanceInWh(user)` | Total in Wh | Wh |
| `getLockedBalanceInWh(user)` | Locked in Wh | Wh |
| `getAvailableBalanceInWh(user)` | Available in Wh | Wh |
| `getVirtualBalanceInKwh(user)` | Total in kWh | kWh |
| `getLockedBalanceInKwh(user)` | Locked in kWh | kWh |
| `getAvailableBalanceInKwh(user)` | Available in kWh | kWh |

### Balance Example

```javascript
// Producer has:
Virtual Balance:   5000 Wh
Locked Balance:    1000 Wh (1 active offer)
Available Balance: 4000 Wh

// Can create new offers up to 4000 Wh
// Cannot transfer/consume locked 1000 Wh until offer is matched/cancelled
```

### Important Notes

1. **Locked balance is NOT transferable**:
   ```bash
   # This will fail if trying to transfer locked energy
   npm run transfer:energy
   # Error: InsufficientAvailableBalance
   ```

2. **Locked balance is NOT consumable**:
   ```bash
   # This will fail if trying to consume locked energy
   npm run consume:energy
   # Error: InsufficientAvailableBalance
   ```

3. **Multiple offers lock cumulative amounts**:
   ```javascript
   Offer 1: 1000 Wh → Locked: 1000 Wh
   Offer 2: 500 Wh  → Locked: 1500 Wh
   Offer 3: 200 Wh  → Locked: 1700 Wh
   ```

---

## Events

### OfferCreated

```solidity
event OfferCreated(
    uint256 indexed offerId,
    address indexed seller,
    uint256 amountWh,
    uint256 pricePerKwh,
    uint256 timestamp
);
```

**Emitted**: When a new offer is created

### OfferMatched

```solidity
event OfferMatched(
    uint256 indexed offerId,
    address indexed seller,
    address indexed buyer,
    uint256 amountWh,
    uint256 pricePerKwh,
    uint256 timestamp,
    uint256 newOfferId  // 0 if full match, >0 if partial
);
```

**Emitted**: When an offer is matched (full or partial)

### OfferCancelled

```solidity
event OfferCancelled(
    uint256 indexed offerId,
    address indexed seller,
    uint256 amountWh,
    uint256 timestamp
);
```

**Emitted**: When an offer is cancelled

### OfferCompleted

```solidity
event OfferCompleted(
    uint256 indexed offerId,
    address indexed seller,
    uint256 timestamp
);
```

**Emitted**: When an offer is fully matched

---

## Security

### Double-Spending Prevention

The locked balance mechanism prevents double-spending:

```solidity
// When creating offer
lockedBalance[seller] += amountWh;  // Lock energy

// When transferring/consuming
availableBalance = virtualBalance[seller] - lockedBalance[seller];
if (availableBalance < amount) revert InsufficientAvailableBalance();
```

### Access Control

```solidity
// Only registered producers can create offers
if (producerTotalProduction[seller] == 0) revert NotAProducer();

// Only seller or owner can cancel
if (msg.sender != offer.seller && msg.sender != owner) revert NotOfferSeller();

// Only owner can match
function matchEnergyOffer(...) external onlyOwner { ... }
```

### Validations

All functions validate inputs:

```solidity
// Amount must be > 0
modifier validAmount(uint256 _amount) {
    if (_amount == 0) revert InvalidAmount();
    _;
}

// Address must not be zero
modifier validAddress(address _address) {
    if (_address == address(0)) revert InvalidAddress();
    _;
}

// Offer must exist
if (offerId >= allEnergyOffers.length) revert InvalidOfferId();

// Offer must be ACTIVE
if (offer.status != OfferStatus.ACTIVE) revert OfferNotActive();
```

---

## Testing

### Test Scenarios

#### 1. Create Offer Flow

```bash
# 1. Become a producer
npm run mint:spark

# 2. Create offer
OFFER_AMOUNT_WH=1000 OFFER_PRICE_PER_KWH=15000000 npm run create:offer

# 3. Verify
npm run query:offers
```

**Expected**: Offer created with ACTIVE status, energy locked

#### 2. Full Match Flow

```bash
# 1. Create offer
OFFER_AMOUNT_WH=1000 OFFER_PRICE_PER_KWH=15000000 npm run create:offer

# 2. Match completely
OFFER_ID=0 BUYER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=1000 npm run match:offer

# 3. Verify
npm run query:offers  # Status: COMPLETED
npm run query:transactions  # Transaction record exists
```

**Expected**: Offer status = COMPLETED, energy transferred, transaction created

#### 3. Partial Match Flow

```bash
# 1. Create 2 kWh offer
OFFER_AMOUNT_WH=2000 OFFER_PRICE_PER_KWH=15000000 npm run create:offer

# 2. Match 1 kWh only
OFFER_ID=0 BUYER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=1000 npm run match:offer

# 3. Verify
npm run query:offers
# Expected: Offer #0 = PARTIALLY_FILLED, Offer #1 = ACTIVE (1000 Wh remaining)
```

**Expected**: Original PARTIALLY_FILLED, new offer created with remainder

#### 4. Cancel Flow

```bash
# 1. Create offer
OFFER_AMOUNT_WH=1000 OFFER_PRICE_PER_KWH=15000000 npm run create:offer

# 2. Cancel
OFFER_ID=0 npm run cancel:offer

# 3. Verify
npm run query:offers  # Status: CANCELLED
# Check locked balance decreased
```

**Expected**: Offer cancelled, energy unlocked

#### 5. Balance Lock Test

```bash
# 1. Check initial balances
npm run query:balance

# 2. Create offer with all available energy
# If available = 1000 Wh
OFFER_AMOUNT_WH=1000 OFFER_PRICE_PER_KWH=15000000 npm run create:offer

# 3. Try to create another offer
OFFER_AMOUNT_WH=100 OFFER_PRICE_PER_KWH=15000000 npm run create:offer
# Expected: ❌ InsufficientAvailableBalance

# 4. Try to transfer locked energy
npm run transfer:energy
# Expected: ❌ InsufficientAvailableBalance
```

---

## Troubleshooting

### Issue 1: NotAProducer Error

**Symptoms**:
```
❌ Error creating energy offer:
CONTRACT_REVERT_EXECUTED
Possible reasons:
- You are not a registered producer
```

**Cause**: Account has never recorded energy production

**Solution**:
```bash
# Register as producer by minting at least once
npm run mint:spark

# Then try creating offer again
npm run create:offer
```

---

### Issue 2: InsufficientAvailableBalance

**Symptoms**:
```
❌ Error creating energy offer:
CONTRACT_REVERT_EXECUTED
Possible reasons:
- Insufficient available balance (virtual - locked)
```

**Diagnosis**:
```bash
# Check your balances
npm run query:balance

# Look for:
# Virtual Balance: X Wh
# Locked Balance: Y Wh
# Available Balance: Z Wh (must be >= offer amount)
```

**Solution**:
```bash
# Option 1: Cancel existing offers to unlock energy
OFFER_ID=0 npm run cancel:offer

# Option 2: Wait for offers to be matched

# Option 3: Produce more energy
npm run mint:spark
```

---

### Issue 3: InvalidOfferId

**Symptoms**:
```
❌ Error: Invalid offer ID (does not exist)
```

**Solution**:
```bash
# Check available offers
npm run query:offers

# Use correct offer ID from the list
```

---

### Issue 4: OfferNotActive

**Symptoms**:
```
❌ Error: Offer is not ACTIVE (already cancelled/completed)
```

**Diagnosis**:
```bash
# Check offer status
OFFER_ID=0 npm run query:offers
```

**Solution**: Cannot modify non-ACTIVE offers. Create a new offer instead.

---

### Issue 5: NotOfferSeller

**Symptoms**:
```
❌ Error: You are not the seller or contract owner
```

**Solution**: Only the offer creator or contract owner can cancel offers.

---

## Best Practices

### For Producers

1. **Check available balance before creating offers**:
   ```bash
   npm run query:balance  # Check available Wh
   ```

2. **Set competitive prices**:
   ```bash
   # Query grid price for reference
   npm run query:grid-price
   ```

3. **Monitor your offers**:
   ```bash
   QUERY_TYPE=seller npm run query:offers
   ```

4. **Cancel stale offers** if price/conditions change

### For VPP Operators

1. **Match offers efficiently** (prefer full matches when possible)

2. **Use partial matches strategically** when buyers need less energy

3. **Monitor offer liquidity**:
   ```bash
   npm run query:offers  # Check active offers count
   ```

4. **Track transaction history**:
   ```bash
   npm run query:transactions
   ```

---

## Economics & Pricing

### Price Discovery

```javascript
// Grid price (baseline)
Grid Price: 0.20 EUR/kWh

// VPP offers (typically lower)
Producer A: 0.15 EUR/kWh  ← Competitive
Producer B: 0.18 EUR/kWh
Producer C: 0.12 EUR/kWh  ← Most competitive
```

### Transaction Costs

- **On-chain fees**: Paid in HBAR (by contract)
- **No trading fees**: Direct peer-to-peer
- **Transparent pricing**: All prices on-chain

---

## Summary

The Energy Offers system provides:

✅ **Decentralized trading**: Producers set their own prices
✅ **Security**: Locked balance prevents double-spending
✅ **Flexibility**: Full and partial matching supported
✅ **Transparency**: All offers and transactions on-chain
✅ **Automation**: VPP AI handles matching logic
✅ **Auditability**: Complete history with events

**Key Commands**:
```bash
npm run create:offer     # Create sell offer
npm run cancel:offer     # Cancel offer
npm run match:offer      # Match offer (owner only)
npm run query:offers     # View offers
```

**Next Steps**:
1. Produce energy: `npm run mint:spark`
2. Create your first offer: `npm run create:offer`
3. Monitor offers: `npm run query:offers`

---

**Part of the Autonomous Grid VPP System**
_Empowering renewable energy through blockchain technology_ ⚡🌱
