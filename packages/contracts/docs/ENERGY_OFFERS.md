# Energy Offers System - Complete Guide

## Overview

The Energy Offers system enables **two-sided peer-to-peer energy trading** within the Autonomous Grid VPP. Producers can create sell offers for their produced energy, while consumers can create buy offers to request energy. The VPP AI agent matches these offers efficiently.

**Key Features**:
- 💡 **Sell Offers**: Producers list energy with custom pricing
- 💰 **Buy Offers**: Consumers request energy with maximum price
- 🔒 Automatic balance locking for sell offers (prevents double-spending)
- 🤝 Full and partial offer matching (both sides)
- 📊 Complete offer tracking and history
- ✅ Multi-status offer lifecycle management

---

## Table of Contents

### Sell Offers (Energy Sales)
- [Sell Offers Concepts](#sell-offers-concepts)
- [Sell Offer Lifecycle](#sell-offer-lifecycle)
- [Creating Sell Offers](#creating-sell-offers)
- [Matching Sell Offers](#matching-sell-offers)
- [Cancelling Sell Offers](#cancelling-sell-offers)
- [Querying Sell Offers](#querying-sell-offers)

### Buy Offers (Energy Requests)
- [Buy Offers Concepts](#buy-offers-concepts)
- [Buy Offer Lifecycle](#buy-offer-lifecycle)
- [Creating Buy Offers](#creating-buy-offers)
- [Matching Buy Offers](#matching-buy-offers)
- [Cancelling Buy Offers](#cancelling-buy-offers)
- [Querying Buy Offers](#querying-buy-offers)

### Common Topics
- [Access Control](#access-control)
- [Balance Management](#balance-management)
- [Events](#events)
- [Security](#security)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

# SELL OFFERS (Energy Sales)

## Sell Offers Concepts

### What is a Sell Offer?

A sell offer is a proposal created by an energy producer to sell energy. It specifies:
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

## Sell Offer Lifecycle

A sell offer progresses through different states:

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

## Creating Sell Offers

### Producer Requirements

To create a sell offer, you must be a **registered producer**:

```solidity
// You must have produced energy at least once
producerTotalProduction[seller] > 0
```

**How to become a registered producer**:
```bash
npm run mint:spark  # Record your first production
```

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

## Matching Sell Offers

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

## Cancelling Sell Offers

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

## Querying Sell Offers

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

# BUY OFFERS (Energy Requests)

## Buy Offers Concepts

### What is a Buy Offer?

A buy offer is a request created by a consumer to purchase energy. It specifies:
- **Amount**: Energy quantity needed in Wh (Watt-hours)
- **Max Price**: Maximum willing to pay in EUR per kWh (with 8 decimals precision)
- **Buyer**: The consumer's address
- **Status**: Current state (ACTIVE, CANCELLED, COMPLETED, PARTIALLY_FILLED)

### Buy Offer Economics

```
Example Buy Offer:
- Amount: 1000 Wh (1 kWh)
- Max Price: 20000000 (0.20 EUR/kWh with 8 decimals)
- Maximum Total Cost: 0.20 EUR
```

### Key Difference from Sell Offers: NO Locked Balance

**Important**: Unlike sell offers, buy offers do NOT lock virtual balance:

```
Virtual Balance: 5000 Wh
Buy Offers Created: 3 offers totaling 2000 Wh
Locked Balance: 0 Wh (buy offers don't lock!)
Available Balance: 5000 Wh (unchanged)
```

**Why?** Payment is handled off-chain. Buy offers are simply requests indicating intent to purchase.

---

## Buy Offer Lifecycle

A buy offer progresses through the same states as sell offers:

```
┌──────────────┐
│              │
│  CREATED     │  Consumer creates buy request
│  (ACTIVE)    │  → NO energy locked
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
     Buyer/Owner         Full Match           │ Partial Match
     cancels request     → Energy             │ → New buy offer
                          transferred         │   created with
                                              │   remaining Wh
                                              v
                                       ┌──────────────┐
                                       │              │
                                       │  NEW BUY     │
                                       │  OFFER       │
                                       │  (ACTIVE)    │
                                       │              │
                                       └──────────────┘
```

### Status Descriptions

Same as sell offers:

| Status | Description | Energy Locked? | Can be Modified? |
|--------|-------------|----------------|------------------|
| **ACTIVE** | Request available for matching | ❌ No | ✅ Can cancel |
| **CANCELLED** | Request cancelled by buyer/owner | ❌ No | ❌ Final state |
| **COMPLETED** | Request fully matched and executed | ❌ No | ❌ Final state |
| **PARTIALLY_FILLED** | Request partially matched, new request created | ❌ No | ❌ Final state |

---

## Creating Buy Offers

### Who Can Create Buy Offers?

**Anyone** can create buy offers - no registration required!

```solidity
// NO producer registration check
// NO balance lock
// Just create the request
```

This is different from sell offers which require:
- ✅ Registered producer status
- ✅ Sufficient available balance
- ✅ Balance locking

### Function Signature

```solidity
function createEnergyBuyOffer(
    uint256 amountWh,          // Amount needed in Wh
    uint256 maxPricePerKwh     // Max price in EUR/kWh (8 decimals)
) external
```

### Requirements

1. ✅ `amountWh` > 0
2. ✅ `maxPricePerKwh` > 0
3. ❌ NO producer registration required
4. ❌ NO balance check required

### Example: Create a Buy Offer

```bash
# Create buy offer: Need 1 kWh, willing to pay up to 0.20 EUR/kWh
BUY_OFFER_AMOUNT_WH=1000 BUY_OFFER_MAX_PRICE_PER_KWH=20000000 npm run create:buy-offer
```

**What happens**:
1. Contract validates amounts > 0
2. Creates buy offer with unique ID
3. Stores in global and buyer-specific arrays
4. Emits `BuyOfferCreated` event
5. **NO balance lock** - this is key!

**Output**:
```
✅ Energy buy offer created successfully!

📊 Transaction Details:
   Transaction ID: 0.0.7107296@1761313199.737994428
   Status: SUCCESS
   Buyer: 0.0.7107296
   Amount: 1000 Wh (1 kWh)
   Max Price: 0.20 EUR/kWh
```

### Price Calculation

Same format as sell offers:

```javascript
// Max price with 8 decimals precision
0.20 EUR/kWh = 20000000 (8 decimals)
0.25 EUR/kWh = 25000000
0.15 EUR/kWh = 15000000

// Formula
maxPriceWithDecimals = maxPrice * 10^8
```

---

## Matching Buy Offers

### Function Signature

```solidity
function matchEnergyBuyOffer(
    uint256 offerId,        // Buy offer ID to match
    address seller,         // Seller address (who has energy)
    uint256 amountWh        // Amount to match (can be partial)
) external onlyOwner
```

### Requirements

1. ✅ Caller must be contract owner (VPP AI)
2. ✅ Buy offer must exist and be ACTIVE
3. ✅ `amountWh` <= buyOffer.amountWh
4. ✅ `seller` != zero address
5. ✅ Seller must have sufficient available balance

### Full Match Example

```bash
# Match entire buy offer (1000 Wh) with a seller
BUY_OFFER_ID=0 SELLER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=1000 npm run match:buy-offer
```

**What happens**:
1. Validates buy offer is ACTIVE
2. Validates seller has sufficient available balance
3. Transfers energy: `virtualBalance[seller] -= 1000 Wh`, `virtualBalance[buyer] += 1000 Wh`
4. Creates transaction record
5. Updates buy offer status to COMPLETED
6. Emits `BuyOfferMatched` and `BuyOfferCompleted` events

### Partial Match Example

```bash
# Match only 500 Wh out of 1000 Wh buy request
BUY_OFFER_ID=0 SELLER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=500 npm run match:buy-offer
```

**What happens**:
1. Validates buy offer is ACTIVE
2. Validates seller has sufficient available balance (500 Wh)
3. Transfers matched energy: `virtualBalance[seller] -= 500 Wh`, `virtualBalance[buyer] += 500 Wh`
4. Creates transaction record for 500 Wh
5. **Automatically creates new buy offer** with remaining 500 Wh at same max price
6. Updates original buy offer status to PARTIALLY_FILLED
7. Emits `BuyOfferMatched`, `BuyOfferCreated` (for new request) events

**Output**:
```
✅ Energy buy offer matched successfully!

📊 Transaction Details:
   Transaction ID: 0.0.7107296@1761313199.737994428
   Status: SUCCESS
   Buy Offer ID: 0
   Seller: 0.0.12345
   Matched Amount: 500 Wh (0.5 kWh)

💡 Note:
   - Partial match: New buy offer created with remaining 500 Wh
   - New Buy Offer ID: 1
   - Energy transferred from seller to buyer
   - Transaction record created for audit trail
```

### Matching Flow Diagram

```
Original Buy Offer: 1000 Wh @ max 0.20 EUR/kWh
Match Request: 500 Wh from Seller

┌─────────────────────┐
│ Original Buy Offer  │
│  #0 Amount: 1000 Wh │
│  Status: ACTIVE     │
└──────────┬──────────┘
           │
           │ Match 500 Wh
           v
┌──────────────────────────────────┐
│  Partial Match Processing        │
│  1. Check seller has 500 Wh      │
│  2. Transfer 500 Wh to buyer     │
│  3. Create new buy offer         │
└──────────┬──────────┬────────────┘
           │          │
           v          v
    ┌──────────┐  ┌──────────────┐
    │ Buy #0   │  │ Buy Offer #1 │
    │ Status:  │  │ Amount: 500  │
    │PARTIALLY │  │ Status:      │
    │ FILLED   │  │ ACTIVE       │
    └──────────┘  └──────────────┘
```

---

## Cancelling Buy Offers

### Function Signature

```solidity
function cancelEnergyBuyOffer(
    uint256 offerId         // Buy offer ID to cancel
) external
```

### Requirements

1. ✅ Buy offer must exist
2. ✅ Buy offer must be ACTIVE
3. ✅ Caller must be buyer OR contract owner

### Example

```bash
# Cancel buy offer #0
BUY_OFFER_ID=0 npm run cancel:buy-offer
```

**What happens**:
1. Validates buy offer exists and is ACTIVE
2. Validates caller is buyer or owner
3. Updates buy offer status to CANCELLED
4. Updates buyer's offer array
5. Emits `BuyOfferCancelled` event
6. **NO balance unlock** (nothing was locked!)

**Output**:
```
✅ Energy buy offer cancelled successfully!

📊 Transaction Details:
   Transaction ID: 0.0.7107296@1761313199.737994428
   Status: SUCCESS
   Buy Offer ID: 0
   Caller: 0.0.7107296
```

---

## Querying Buy Offers

### Available Queries

| Function | Description | Parameters |
|----------|-------------|------------|
| `getActiveBuyOffers()` | All active buy offers (paginated) | offset, limit |
| `getBuyOffersByBuyer()` | Buy offers by specific buyer | buyer, offset, limit |
| `getAllBuyOffers()` | Complete buy offer history | offset, limit |
| `getBuyOfferById()` | Single buy offer details | offerId |
| `getActiveBuyOffersCount()` | Total active buy offers | - |
| `getTotalBuyOffersCount()` | Total buy offers ever created | - |
| `getBuyerOffersCount()` | Buy offers count per buyer | buyer |

### Query Examples

#### 1. View All Active Buy Offers

```bash
npm run query:buy-offers
```

**Output**:
```
📊 Found 3 active buy offers:

--- Buy Offer #1 ---
   Buy Offer ID: 0
   Buyer: 0x00000000000000000000000000000000006c72e0
   Amount: 1000 Wh (1 kWh)
   Max Price: 0.20 EUR/kWh (20000000 smallest units)
   Timestamp: 2025-01-25T10:00:00.000Z
   Status: ACTIVE

--- Buy Offer #2 ---
   Buy Offer ID: 1
   Buyer: 0x00000000000000000000000000000000006c72f1
   Amount: 500 Wh (0.5 kWh)
   Max Price: 0.18 EUR/kWh (18000000 smallest units)
   Timestamp: 2025-01-25T10:15:00.000Z
   Status: ACTIVE

📈 Buy Offer Statistics:
   Total Buy Offers: 5
   Active Buy Offers: 3
```

#### 2. View Buy Offers by Buyer

```bash
QUERY_TYPE=buyer BUYER_ADDRESS=0.0.7107296 npm run query:buy-offers
```

#### 3. View All Buy Offers (History)

```bash
QUERY_TYPE=all npm run query:buy-offers
```

#### 4. View Specific Buy Offer

```bash
BUY_OFFER_ID=0 npm run query:buy-offers
```

#### 5. Paginated Queries

```bash
# Get buy offers 10-20
OFFSET=10 LIMIT=10 npm run query:buy-offers
```

---

# COMMON TOPICS

## Access Control

### Who Can Do What?

| Action | Registered Producers | Anyone | Contract Owner (VPP AI) |
|--------|---------------------|--------|------------------------|
| **Sell Offers** | | | |
| Create Sell Offer | ✅ Yes | ❌ No | ✅ Yes |
| Cancel Sell Offer | ✅ Yes (own) | ❌ No | ✅ Yes (any) |
| Match Sell Offer | ❌ No | ❌ No | ✅ Yes (only) |
| **Buy Offers** | | | |
| Create Buy Offer | ✅ Yes | ✅ Yes | ✅ Yes |
| Cancel Buy Offer | ✅ Yes (own) | ✅ Yes (own) | ✅ Yes (any) |
| Match Buy Offer | ❌ No | ❌ No | ✅ Yes (only) |
| **Query** | | | |
| Query All Offers | ✅ Yes | ✅ Yes | ✅ Yes |

### Key Differences

**Sell Offers (Supply-Side)**:
- Must be registered producer (have produced energy at least once)
- Must have sufficient available balance
- Energy gets locked when offer created

**Buy Offers (Demand-Side)**:
- Anyone can create (no registration)
- No balance requirement
- No energy locked

**Both**:
- Only VPP AI (contract owner) can match offers
- Seller/buyer or owner can cancel

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

### Sell Offer Events

#### OfferCreated

```solidity
event OfferCreated(
    uint256 indexed offerId,
    address indexed seller,
    uint256 amountWh,
    uint256 pricePerKwh,
    uint256 timestamp
);
```

**Emitted**: When a new sell offer is created

#### OfferMatched

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

**Emitted**: When a sell offer is matched (full or partial)

#### OfferCancelled

```solidity
event OfferCancelled(
    uint256 indexed offerId,
    address indexed seller,
    uint256 amountWh,
    uint256 timestamp
);
```

**Emitted**: When a sell offer is cancelled

#### OfferCompleted

```solidity
event OfferCompleted(
    uint256 indexed offerId,
    address indexed seller,
    uint256 timestamp
);
```

**Emitted**: When a sell offer is fully matched

---

### Buy Offer Events

#### BuyOfferCreated

```solidity
event BuyOfferCreated(
    uint256 indexed offerId,
    address indexed buyer,
    uint256 amountWh,
    uint256 maxPricePerKwh,
    uint256 timestamp
);
```

**Emitted**: When a new buy offer is created

#### BuyOfferMatched

```solidity
event BuyOfferMatched(
    uint256 indexed offerId,
    address indexed buyer,
    address indexed seller,
    uint256 amountWh,
    uint256 timestamp,
    uint256 newOfferId  // 0 if full match, >0 if partial
);
```

**Emitted**: When a buy offer is matched (full or partial)

#### BuyOfferCancelled

```solidity
event BuyOfferCancelled(
    uint256 indexed offerId,
    address indexed buyer,
    uint256 amountWh,
    uint256 timestamp
);
```

**Emitted**: When a buy offer is cancelled

#### BuyOfferCompleted

```solidity
event BuyOfferCompleted(
    uint256 indexed offerId,
    address indexed buyer,
    uint256 timestamp
);
```

**Emitted**: When a buy offer is fully matched

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

### Sell Offer Test Scenarios

#### 1. Create Sell Offer Flow

```bash
# 1. Become a producer
npm run mint:spark

# 2. Create offer
OFFER_AMOUNT_WH=1000 OFFER_PRICE_PER_KWH=15000000 npm run create:offer

# 3. Verify
npm run query:offers
```

**Expected**: Sell offer created with ACTIVE status, energy locked

#### 2. Full Sell Match Flow

```bash
# 1. Create offer
OFFER_AMOUNT_WH=1000 OFFER_PRICE_PER_KWH=15000000 npm run create:offer

# 2. Match completely
OFFER_ID=0 BUYER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=1000 npm run match:offer

# 3. Verify
npm run query:offers  # Status: COMPLETED
npm run query:transactions  # Transaction record exists
```

**Expected**: Sell offer status = COMPLETED, energy transferred, transaction created

#### 3. Partial Sell Match Flow

```bash
# 1. Create 2 kWh offer
OFFER_AMOUNT_WH=2000 OFFER_PRICE_PER_KWH=15000000 npm run create:offer

# 2. Match 1 kWh only
OFFER_ID=0 BUYER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=1000 npm run match:offer

# 3. Verify
npm run query:offers
# Expected: Offer #0 = PARTIALLY_FILLED, Offer #1 = ACTIVE (1000 Wh remaining)
```

**Expected**: Original PARTIALLY_FILLED, new sell offer created with remainder

#### 4. Cancel Sell Offer Flow

```bash
# 1. Create offer
OFFER_AMOUNT_WH=1000 OFFER_PRICE_PER_KWH=15000000 npm run create:offer

# 2. Cancel
OFFER_ID=0 npm run cancel:offer

# 3. Verify
npm run query:offers  # Status: CANCELLED
# Check locked balance decreased
```

**Expected**: Sell offer cancelled, energy unlocked

#### 5. Balance Lock Test (Sell Offers)

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

### Buy Offer Test Scenarios

#### 6. Create Buy Offer Flow (No Registration)

```bash
# 1. Create buy offer WITHOUT being a producer
BUY_OFFER_AMOUNT_WH=1000 BUY_OFFER_MAX_PRICE_PER_KWH=20000000 npm run create:buy-offer

# 2. Verify
npm run query:buy-offers
```

**Expected**: Buy offer created successfully, NO registration or balance check

#### 7. Full Buy Match Flow

```bash
# 1. Create buy offer
BUY_OFFER_AMOUNT_WH=1000 BUY_OFFER_MAX_PRICE_PER_KWH=20000000 npm run create:buy-offer

# 2. Match with seller who has energy
BUY_OFFER_ID=0 SELLER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=1000 npm run match:buy-offer

# 3. Verify
npm run query:buy-offers  # Status: COMPLETED
npm run query:transactions  # Transaction record exists
```

**Expected**: Buy offer status = COMPLETED, energy transferred from seller to buyer

#### 8. Partial Buy Match Flow

```bash
# 1. Create 2 kWh buy request
BUY_OFFER_AMOUNT_WH=2000 BUY_OFFER_MAX_PRICE_PER_KWH=20000000 npm run create:buy-offer

# 2. Match 1 kWh only
BUY_OFFER_ID=0 SELLER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=1000 npm run match:buy-offer

# 3. Verify
npm run query:buy-offers
# Expected: Buy Offer #0 = PARTIALLY_FILLED, Buy Offer #1 = ACTIVE (1000 Wh remaining)
```

**Expected**: Original PARTIALLY_FILLED, new buy offer created with remainder

#### 9. Cancel Buy Offer Flow

```bash
# 1. Create buy offer
BUY_OFFER_AMOUNT_WH=1000 BUY_OFFER_MAX_PRICE_PER_KWH=20000000 npm run create:buy-offer

# 2. Cancel
BUY_OFFER_ID=0 npm run cancel:buy-offer

# 3. Verify
npm run query:buy-offers  # Status: CANCELLED
```

**Expected**: Buy offer cancelled (no balance unlock since nothing was locked)

#### 10. No Balance Lock Test (Buy Offers)

```bash
# 1. Check initial balances
npm run query:balance

# 2. Create multiple buy offers
BUY_OFFER_AMOUNT_WH=1000 BUY_OFFER_MAX_PRICE_PER_KWH=20000000 npm run create:buy-offer
BUY_OFFER_AMOUNT_WH=2000 BUY_OFFER_MAX_PRICE_PER_KWH=20000000 npm run create:buy-offer

# 3. Check balances again
npm run query:balance
# Expected: Locked balance = 0 (buy offers don't lock!)

# 4. Can still transfer/consume all energy
npm run transfer:energy
# Expected: ✅ Works! (no locked balance from buy offers)
```

---

## Troubleshooting

### Sell Offer Issues

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

**Solution**: Only the offer creator or contract owner can cancel sell offers.

---

### Buy Offer Issues

#### Issue 6: InvalidBuyOfferId

**Symptoms**:
```
❌ Error: Invalid buy offer ID (does not exist)
```

**Solution**:
```bash
# Check available buy offers
npm run query:buy-offers

# Use correct buy offer ID from the list
```

---

#### Issue 7: BuyOfferNotActive

**Symptoms**:
```
❌ Error: Buy offer is not ACTIVE (already cancelled/completed)
```

**Diagnosis**:
```bash
# Check buy offer status
BUY_OFFER_ID=0 npm run query:buy-offers
```

**Solution**: Cannot modify non-ACTIVE buy offers. Create a new buy offer instead.

---

#### Issue 8: InsufficientSellerBalance

**Symptoms**:
```
❌ Error matching energy buy offer:
CONTRACT_REVERT_EXECUTED
Possible reasons:
- Seller has insufficient available balance
```

**Diagnosis**:
```bash
# Check seller's available balance
# The seller needs enough energy to fulfill the match
```

**Solution**:
- Choose a different seller with more available energy
- Reduce match amount to seller's available balance
- Wait for seller to produce more energy

---

#### Issue 9: NotBuyOfferBuyer

**Symptoms**:
```
❌ Error: You are not the buyer or contract owner
```

**Solution**: Only the buy offer creator or contract owner can cancel buy offers.

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

### For Consumers

1. **Set realistic max prices** for buy offers:
   ```bash
   # Check current market prices
   npm run query:offers  # See active sell offers
   npm run query:grid-price  # Compare with grid price
   ```

2. **Monitor your buy requests**:
   ```bash
   QUERY_TYPE=buyer npm run query:buy-offers
   ```

3. **No balance lock** - create buy offers freely without worrying about locked energy

4. **Cancel unfulfilled requests** if no longer needed:
   ```bash
   BUY_OFFER_ID=0 npm run cancel:buy-offer
   ```

### For VPP Operators

1. **Match offers efficiently** (prefer full matches when possible)

2. **Use partial matches strategically** for both sell and buy offers

3. **Monitor marketplace liquidity**:
   ```bash
   npm run query:offers       # Check active sell offers
   npm run query:buy-offers   # Check active buy requests
   ```

4. **Match efficiently** by pairing buy offers with best-priced sell offers

5. **Track transaction history**:
   ```bash
   npm run query:transactions
   ```

---

## Economics & Pricing

### Price Discovery (Two-Sided Market)

**Sell Side (Supply)**:
```javascript
// Grid price (baseline)
Grid Price: 0.20 EUR/kWh

// Sell offers from producers (typically lower)
Producer A: 0.15 EUR/kWh  ← Competitive
Producer B: 0.18 EUR/kWh
Producer C: 0.12 EUR/kWh  ← Most competitive
```

**Buy Side (Demand)**:
```javascript
// Buy offers from consumers
Consumer 1: Max 0.20 EUR/kWh  ← Willing to pay grid price
Consumer 2: Max 0.16 EUR/kWh  ← Wants discount
Consumer 3: Max 0.25 EUR/kWh  ← Premium buyer
```

**VPP Matching Strategy**:
- Match buy offers with lowest-priced sell offers first
- Ensure buyer's max price >= seller's price
- Optimize for maximum market efficiency

### Transaction Costs

- **On-chain fees**: Paid in HBAR (by contract)
- **No trading fees**: Direct peer-to-peer
- **Transparent pricing**: All prices on-chain

---

## Summary

The Energy Offers system provides a **complete two-sided marketplace**:

### Sell Offers (Supply Side)
✅ **Producer-only creation**: Registered producers set their own prices
✅ **Balance locking**: Prevents double-spending automatically
✅ **Full & partial matching**: Flexible fulfillment options
✅ **Transaction tracking**: Complete audit trail

### Buy Offers (Demand Side)
✅ **Open to anyone**: No registration required
✅ **No balance lock**: Create requests freely
✅ **Price limits**: Set maximum willing to pay
✅ **Partial fulfillment**: Get energy as available

### Common Features
✅ **Transparency**: All offers and transactions on-chain
✅ **VPP AI automation**: Intelligent matching by contract owner
✅ **Event-driven**: Real-time updates via blockchain events
✅ **Auditability**: Complete history with timestamps

---

## Quick Start Commands

### Sell Offers
```bash
npm run create:offer     # Create sell offer (producers only)
npm run cancel:offer     # Cancel sell offer
npm run match:offer      # Match sell offer (VPP AI only)
npm run query:offers     # View sell offers
```

### Buy Offers
```bash
npm run create:buy-offer    # Create buy offer (anyone)
npm run cancel:buy-offer    # Cancel buy offer
npm run match:buy-offer     # Match buy offer (VPP AI only)
npm run query:buy-offers    # View buy offers
```

---

## Getting Started

### As a Producer (Seller)
1. Register as producer: `npm run mint:spark`
2. Create sell offer: `OFFER_AMOUNT_WH=1000 OFFER_PRICE_PER_KWH=15000000 npm run create:offer`
3. Monitor your offers: `QUERY_TYPE=seller npm run query:offers`

### As a Consumer (Buyer)
1. Create buy offer: `BUY_OFFER_AMOUNT_WH=1000 BUY_OFFER_MAX_PRICE_PER_KWH=20000000 npm run create:buy-offer`
2. Monitor your requests: `QUERY_TYPE=buyer npm run query:buy-offers`
3. Wait for VPP AI to match with sellers

### As VPP Operator
1. Monitor marketplace: `npm run query:offers && npm run query:buy-offers`
2. Match sell offers: `OFFER_ID=0 BUYER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=1000 npm run match:offer`
3. Match buy offers: `BUY_OFFER_ID=0 SELLER_ADDRESS=0.0.12345 MATCH_AMOUNT_WH=1000 npm run match:buy-offer`

---

**Part of the Autonomous Grid VPP System**
_Empowering renewable energy through blockchain technology_ ⚡🌱
