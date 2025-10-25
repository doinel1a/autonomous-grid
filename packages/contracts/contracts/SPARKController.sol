// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IHederaTokenService} from "./interfaces/IHederaTokenService.sol";
import {IPyth} from "./interfaces/IPyth.sol";
import {PythStructs} from "./interfaces/PythStructs.sol";

/**
 * @title SPARKController
 * @notice Controller for SPARK token production tracking and management
 * @dev Manages minting, burning, and tracking of solar energy production
 *
 * Token Economics: 1 SPARK = 1 Wh of solar energy (with 8 decimals precision)
 *
 * Features:
 * - Dynamic mint/burn of SPARK tokens
 * - Production tracking per producer
 * - Hourly and daily aggregates
 * - Query functions for analytics
 * - Owner-only access control
 */
contract SPARKController {
  /// @notice Hedera Token Service precompiled contract address
  address private constant HTS_PRECOMPILE = 0x0000000000000000000000000000000000000167;

  /// @notice HTS response codes
  int32 private constant HTS_SUCCESS = 22;

  /// @notice Pyth Network EUR/USD price feed ID
  bytes32 public constant EUR_USD_PRICE_FEED_ID = 0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b;

  /// @notice Maximum age for Pyth price feeds (60 seconds)
  uint256 public constant MAX_PRICE_AGE = 60;

  /// @notice Pyth oracle contract address
  address public immutable PYTH_ORACLE_ADDRESS;

  /// @notice Conversion rate: 1 SPARK = 1 Wh
  uint256 public constant SPARK_PER_WH = 1;

  /// @notice Token decimals (SPARK has 8 decimals due to uint64 limit in HTS mintToken)
  uint256 public constant DECIMALS = 8;

  /// @notice SPARK token address (HTS token)
  address public immutable SPARK_TOKEN_ADDRESS;

  /// @notice Contract owner (has exclusive mint/burn/record permissions)
  address public owner;

  /// @notice Grid energy price in EUR per kWh (with 8 decimals precision)
  uint256 public gridEnergyPriceEUR;

  /// @notice Timestamp of last grid price update
  uint256 public lastGridPriceUpdate;

  /// @notice Production record structure
  struct ProductionRecord {
    address producer; // Producer address
    uint256 amount; // Amount in SPARK tokens
    uint256 timestamp; // Block timestamp
  }

  /// @notice Hourly aggregate structure
  struct HourlyAggregate {
    uint256 totalAmount; // Total SPARK produced in this hour
    uint256 recordCount; // Number of production records
  }

  /// @notice Daily aggregate structure
  struct DailyAggregate {
    uint256 totalAmount; // Total SPARK produced in this day
    uint256 recordCount; // Number of production records
  }

  /// @notice Transaction record structure
  struct TransactionRecord {
    address seller; // Seller address
    address buyer; // Buyer address
    uint256 amount; // Amount in SPARK tokens
    uint256 timestamp; // Block timestamp
  }

  /// @notice Energy offer status enum
  enum OfferStatus {
    ACTIVE, // Offer is active and can be matched
    CANCELLED, // Offer was cancelled by seller or owner
    COMPLETED, // Offer was fully matched
    PARTIALLY_FILLED // Offer was partially matched and a new offer was created
  }

  /// @notice Energy sell offer structure
  struct EnergyOffer {
    uint256 offerId; // Unique offer ID
    address seller; // Seller address
    uint256 amountWh; // Amount in Wh available for sale
    uint256 pricePerKwh; // Price in EUR per kWh (with 8 decimals precision)
    uint256 timestamp; // Creation timestamp
    OfferStatus status; // Offer status
  }

  /// @notice Energy buy offer structure
  struct EnergyBuyOffer {
    uint256 offerId; // Unique offer ID
    address buyer; // Buyer address
    uint256 amountWh; // Amount in Wh to purchase
    uint256 maxPricePerKwh; // Maximum price in EUR per kWh (with 8 decimals precision)
    uint256 timestamp; // Creation timestamp
    OfferStatus status; // Offer status
  }

  /// @notice All production records (global)
  ProductionRecord[] public allProductionRecords;

  /// @notice Production records per producer
  /// @dev producer => ProductionRecord[]
  mapping(address => ProductionRecord[]) public producerRecords;

  /// @notice Total production per producer
  /// @dev producer => total SPARK amount
  mapping(address => uint256) public producerTotalProduction;

  /// @notice Hourly aggregates per producer
  /// @dev producer => hourKey (timestamp / 3600) => HourlyAggregate
  mapping(address => mapping(uint256 => HourlyAggregate)) public hourlyAggregates;

  /// @notice Daily aggregates per producer
  /// @dev producer => dayKey (timestamp / 86400) => DailyAggregate
  mapping(address => mapping(uint256 => DailyAggregate)) public dailyAggregates;

  /// @notice Virtual balance per user (energy credits)
  /// @dev user => balance in SPARK tokens (smallest units)
  mapping(address => uint256) public virtualBalance;

  /// @notice All transaction records (global)
  TransactionRecord[] public allTransactions;

  /// @notice Transaction records per user
  /// @dev user => TransactionRecord[]
  mapping(address => TransactionRecord[]) public userTransactions;

  /// @notice All energy offers (global)
  EnergyOffer[] public allEnergyOffers;

  /// @notice Energy offer IDs per seller
  /// @dev seller => offer IDs array
  mapping(address => uint256[]) public sellerOfferIds;

  /// @notice Locked balance per user (energy locked in active offers)
  /// @dev user => locked balance in SPARK tokens (smallest units)
  mapping(address => uint256) public lockedBalance;

  /// @notice Next offer ID counter
  uint256 private nextOfferId;

  /// @notice Counter for active energy offers
  uint256 private activeOffersCount;

  /// @notice All energy buy offers (global)
  EnergyBuyOffer[] public allEnergyBuyOffers;

  /// @notice Energy buy offer IDs per buyer
  /// @dev buyer => buy offer IDs array
  mapping(address => uint256[]) public buyerOfferIds;

  /// @notice Next buy offer ID counter
  uint256 private nextBuyOfferId;

  /// @notice Counter for active energy buy offers
  uint256 private activeBuyOffersCount;

  // Events

  /**
   * @notice Emitted when production is recorded and tokens are minted
   * @param producer The producer address
   * @param amount The amount of SPARK tokens minted
   * @param wh The Wh equivalent
   * @param timestamp The timestamp of production
   * @param recordId The global record ID
   */
  event ProductionRecorded(
    address indexed producer,
    uint256 amount,
    uint256 wh,
    uint256 timestamp,
    uint256 indexed recordId
  );

  /**
   * @notice Emitted when tokens are minted
   * @param to The recipient address
   * @param amount The amount of tokens minted
   * @param timestamp The timestamp
   */
  event TokensMinted(address indexed to, uint256 amount, uint256 timestamp);

  /**
   * @notice Emitted when tokens are burned
   * @param from The address from which tokens are burned
   * @param amount The amount of tokens burned
   * @param timestamp The timestamp
   */
  event TokensBurned(address indexed from, uint256 amount, uint256 timestamp);

  /**
   * @notice Emitted when ownership is transferred
   * @param previousOwner The previous owner
   * @param newOwner The new owner
   */
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  /**
   * @notice Emitted when energy is transferred between users
   * @param seller The seller address
   * @param buyer The buyer address
   * @param amount The amount of SPARK tokens transferred
   * @param timestamp The timestamp
   * @param transactionId The global transaction ID
   */
  event EnergyTransferred(
    address indexed seller,
    address indexed buyer,
    uint256 amount,
    uint256 timestamp,
    uint256 indexed transactionId
  );

  /**
   * @notice Emitted when energy is consumed and burned
   * @param consumer The consumer address
   * @param amount The amount of SPARK tokens consumed
   * @param timestamp The timestamp
   */
  event EnergyConsumed(address indexed consumer, uint256 amount, uint256 timestamp);

  /**
   * @notice Emitted when grid energy price is updated
   * @param priceEUR The price in EUR per kWh
   * @param priceUSD The price in USD per kWh (converted at update time)
   * @param eurUsdRate The EUR/USD exchange rate used
   * @param timestamp The timestamp
   */
  event GridEnergyPriceUpdated(
    uint256 priceEUR,
    uint256 priceUSD,
    int64 eurUsdRate,
    uint256 timestamp
  );

  /**
   * @notice Emitted when an energy offer is created
   * @param offerId The unique offer ID
   * @param seller The seller address
   * @param amountWh The amount in Wh
   * @param pricePerKwh The price in EUR per kWh
   * @param timestamp The timestamp
   */
  event OfferCreated(
    uint256 indexed offerId,
    address indexed seller,
    uint256 amountWh,
    uint256 pricePerKwh,
    uint256 timestamp
  );

  /**
   * @notice Emitted when an energy offer is matched
   * @param offerId The offer ID
   * @param seller The seller address
   * @param buyer The buyer address
   * @param amountWh The amount matched in Wh
   * @param pricePerKwh The price in EUR per kWh
   * @param timestamp The timestamp
   * @param newOfferId The new offer ID if partially filled (0 if fully matched)
   */
  event OfferMatched(
    uint256 indexed offerId,
    address indexed seller,
    address indexed buyer,
    uint256 amountWh,
    uint256 pricePerKwh,
    uint256 timestamp,
    uint256 newOfferId
  );

  /**
   * @notice Emitted when an energy offer is cancelled
   * @param offerId The offer ID
   * @param seller The seller address
   * @param amountWh The remaining amount in Wh
   * @param timestamp The timestamp
   */
  event OfferCancelled(
    uint256 indexed offerId,
    address indexed seller,
    uint256 amountWh,
    uint256 timestamp
  );

  /**
   * @notice Emitted when an energy offer is completed
   * @param offerId The offer ID
   * @param seller The seller address
   * @param timestamp The timestamp
   */
  event OfferCompleted(uint256 indexed offerId, address indexed seller, uint256 timestamp);

  /**
   * @notice Emitted when an energy buy offer is created
   * @param offerId The unique buy offer ID
   * @param buyer The buyer address
   * @param amountWh The amount in Wh
   * @param maxPricePerKwh The maximum price in EUR per kWh
   * @param timestamp The timestamp
   */
  event BuyOfferCreated(
    uint256 indexed offerId,
    address indexed buyer,
    uint256 amountWh,
    uint256 maxPricePerKwh,
    uint256 timestamp
  );

  /**
   * @notice Emitted when an energy buy offer is matched
   * @param offerId The buy offer ID
   * @param buyer The buyer address
   * @param seller The seller address
   * @param amountWh The amount matched in Wh
   * @param pricePerKwh The actual price in EUR per kWh
   * @param timestamp The timestamp
   * @param newOfferId The new buy offer ID if partially filled (0 if fully matched)
   */
  event BuyOfferMatched(
    uint256 indexed offerId,
    address indexed buyer,
    address indexed seller,
    uint256 amountWh,
    uint256 pricePerKwh,
    uint256 timestamp,
    uint256 newOfferId
  );

  /**
   * @notice Emitted when an energy buy offer is cancelled
   * @param offerId The buy offer ID
   * @param buyer The buyer address
   * @param amountWh The remaining amount in Wh
   * @param timestamp The timestamp
   */
  event BuyOfferCancelled(
    uint256 indexed offerId,
    address indexed buyer,
    uint256 amountWh,
    uint256 timestamp
  );

  /**
   * @notice Emitted when an energy buy offer is completed
   * @param offerId The buy offer ID
   * @param buyer The buyer address
   * @param timestamp The timestamp
   */
  event BuyOfferCompleted(uint256 indexed offerId, address indexed buyer, uint256 timestamp);

  // Custom Errors (Gas Optimization)

  /// @notice Thrown when caller is not the owner
  error UnauthorizedAccess();

  /// @notice Thrown when an invalid amount is provided (e.g., zero)
  error InvalidAmount();

  /// @notice Thrown when an invalid address is provided (e.g., zero address)
  error InvalidAddress();

  /// @notice Thrown when HTS operation fails
  /// @param responseCode The HTS response code
  error TokenOperationFailed(int32 responseCode);

  /// @notice Thrown when array parameters have mismatched lengths
  error InvalidArrayLength();

  /// @notice Thrown when signature verification fails
  error InvalidSignature();

  /// @notice Thrown when signature has expired
  error SignatureExpired();

  /// @notice Thrown when virtual balance is insufficient for operation
  error InsufficientVirtualBalance();

  /// @notice Thrown when available balance (virtual - locked) is insufficient
  error InsufficientAvailableBalance();

  /// @notice Thrown when offer does not exist or ID is invalid
  error InvalidOfferId();

  /// @notice Thrown when trying to cancel/modify an offer that is not active
  error OfferNotActive();

  /// @notice Thrown when caller is not the seller of the offer
  error NotOfferSeller();

  /// @notice Thrown when caller is not a registered producer
  error NotAProducer();

  /// @notice Thrown when buy offer does not exist or ID is invalid
  error InvalidBuyOfferId();

  /// @notice Thrown when trying to cancel/modify a buy offer that is not active
  error BuyOfferNotActive();

  /// @notice Thrown when caller is not the buyer of the buy offer
  error NotOfferBuyer();

  /// @notice Thrown when Pyth oracle returns invalid price data
  error InvalidOraclePrice();

  /// @notice Thrown when signature has invalid length
  error InvalidSignatureLength();

  /// @notice Thrown when signature version is invalid
  error InvalidSignatureVersion();

  // Modifiers

  /**
   * @notice Restricts function access to contract owner only
   */
  modifier onlyOwner() {
    if (msg.sender != owner) revert UnauthorizedAccess();
    _;
  }

  /**
   * @notice Validates that an address is not zero
   * @param _address The address to validate
   */
  modifier validAddress(address _address) {
    if (_address == address(0)) revert InvalidAddress();
    _;
  }

  /**
   * @notice Validates that an amount is greater than zero
   * @param _amount The amount to validate
   */
  modifier validAmount(uint256 _amount) {
    if (_amount == 0) revert InvalidAmount();
    _;
  }

  // Constructor

  /**
   * @notice Initializes the SPARKController contract
   * @param _sparkTokenAddress The address of the SPARK HTS token
   * @param _owner The address of the contract owner
   * @param _pythOracleAddress The address of the Pyth oracle contract
   */
  constructor(
    address _sparkTokenAddress,
    address _owner,
    address _pythOracleAddress
  ) validAddress(_sparkTokenAddress) validAddress(_owner) validAddress(_pythOracleAddress) {
    SPARK_TOKEN_ADDRESS = _sparkTokenAddress;
    PYTH_ORACLE_ADDRESS = _pythOracleAddress;
    owner = _owner;

    emit OwnershipTransferred(address(0), _owner);
  }

  // Administrative Functions

  /**
   * @notice Transfers ownership to a new address
   * @param newOwner The new owner address
   */
  function transferOwnership(address newOwner) external onlyOwner validAddress(newOwner) {
    address previousOwner = owner;
    owner = newOwner;

    emit OwnershipTransferred(previousOwner, newOwner);
  }

  // Core Functions

  /**
   * @notice Records energy production and mints corresponding SPARK tokens
   * @param producer The producer address
   * @param wh The amount of energy produced in Wh (Watt-hours)
   * @param deadline Signature expiration timestamp
   * @param signature Signature from the owner authorizing this operation
   *
   * @dev Uses signature verification instead of msg.sender check (Hedera compatible)
   * @dev Converts Wh to SPARK tokens (1 Wh = 1 SPARK)
   * @dev Updates all tracking structures (records, aggregates)
   * @dev Emits ProductionRecorded and TokensMinted events
   */
  function recordProductionAndMint(
    address producer,
    uint256 wh,
    uint256 deadline,
    bytes memory signature
  ) external validAddress(producer) validAmount(wh) {
    // Verify signature from owner
    _verifySignature(producer, wh, deadline, signature);

    // Calculate SPARK amount (1 Wh = 1 SPARK)
    // Multiply by 10^8 to account for token decimals
    uint256 sparkAmount = wh * (10 ** DECIMALS);

    // Mint tokens via HTS
    _mintTokens(sparkAmount);

    // Create production record
    uint256 timestamp = block.timestamp;
    ProductionRecord memory record = ProductionRecord({
      producer: producer,
      amount: sparkAmount,
      timestamp: timestamp
    });

    // Store in global records
    allProductionRecords.push(record);
    uint256 recordId = allProductionRecords.length - 1;

    // Store in producer records
    producerRecords[producer].push(record);

    // Update producer total
    producerTotalProduction[producer] += sparkAmount;

    // Update virtual balance
    virtualBalance[producer] += sparkAmount;

    // Update hourly aggregates
    uint256 hourKey = timestamp / 3600; // Unix timestamp / 3600 = hour key
    HourlyAggregate storage hourly = hourlyAggregates[producer][hourKey];
    hourly.totalAmount += sparkAmount;
    hourly.recordCount += 1;

    // Update daily aggregates
    uint256 dayKey = timestamp / 86400; // Unix timestamp / 86400 = day key
    DailyAggregate storage daily = dailyAggregates[producer][dayKey];
    daily.totalAmount += sparkAmount;
    daily.recordCount += 1;

    emit ProductionRecorded(producer, sparkAmount, wh, timestamp, recordId);
  }

  /**
   * @notice Burns SPARK tokens
   * @param amount The amount of SPARK tokens to burn
   *
   * @dev Only callable by owner
   * @dev Burns from treasury (contract must have supply key)
   * @dev Emits TokensBurned event
   */
  function burnTokens(uint256 amount) external onlyOwner validAmount(amount) {
    _burnTokens(amount);

    emit TokensBurned(address(this), amount, block.timestamp);
  }

  /**
   * @notice Transfers energy credits from seller to buyer
   * @param seller The seller address
   * @param buyer The buyer address
   * @param amount The amount of SPARK tokens to transfer (smallest units)
   *
   * @dev Only callable by owner
   * @dev Transfers virtual balance without moving actual tokens
   * @dev Creates transaction record and updates mappings
   * @dev Emits EnergyTransferred event
   */
  function transferEnergy(
    address seller,
    address buyer,
    uint256 amount
  ) external onlyOwner validAddress(seller) validAddress(buyer) validAmount(amount) {
    // Check seller has sufficient available balance (virtual - locked)
    uint256 availableBalance = virtualBalance[seller] - lockedBalance[seller];
    if (availableBalance < amount) revert InsufficientAvailableBalance();

    // Update virtual balances
    virtualBalance[seller] -= amount;
    virtualBalance[buyer] += amount;

    // Create transaction record
    uint256 timestamp = block.timestamp;
    TransactionRecord memory txRecord = TransactionRecord({
      seller: seller,
      buyer: buyer,
      amount: amount,
      timestamp: timestamp
    });

    // Store in global transactions
    allTransactions.push(txRecord);
    uint256 transactionId = allTransactions.length - 1;

    // Store in user transactions
    userTransactions[seller].push(txRecord);
    userTransactions[buyer].push(txRecord);

    emit EnergyTransferred(seller, buyer, amount, timestamp, transactionId);
  }

  /**
   * @notice Consumes energy and burns corresponding tokens from treasury
   * @param consumer The consumer address
   * @param amount The amount of SPARK tokens to consume (smallest units)
   *
   * @dev Only callable by owner
   * @dev Reduces virtual balance and burns tokens from treasury
   * @dev Emits EnergyConsumed and TokensBurned events
   */
  function consumeEnergy(
    address consumer,
    uint256 amount
  ) external onlyOwner validAddress(consumer) validAmount(amount) {
    // Check consumer has sufficient available balance (virtual - locked)
    uint256 availableBalance = virtualBalance[consumer] - lockedBalance[consumer];
    if (availableBalance < amount) revert InsufficientAvailableBalance();

    // Update virtual balance
    virtualBalance[consumer] -= amount;

    // Burn tokens from treasury
    _burnTokens(amount);

    emit EnergyConsumed(consumer, amount, block.timestamp);
  }

  /**
   * @notice Batch record multiple productions and mint tokens
   * @param producers Array of producer addresses
   * @param whAmounts Array of Wh amounts corresponding to each producer
   *
   * @dev Only callable by owner
   * @dev Arrays must have the same length
   * @dev More gas efficient for multiple productions
   */
  function batchRecordProduction(
    address[] calldata producers,
    uint256[] calldata whAmounts
  ) external onlyOwner {
    if (producers.length != whAmounts.length) revert InvalidArrayLength();
    if (producers.length == 0) revert InvalidAmount();

    for (uint256 i = 0; i < producers.length; i++) {
      if (producers[i] == address(0)) revert InvalidAddress();
      if (whAmounts[i] == 0) revert InvalidAmount();

      uint256 sparkAmount = whAmounts[i] * (10 ** DECIMALS);
      uint256 timestamp = block.timestamp;

      // Mint tokens
      _mintTokens(sparkAmount);

      // Create and store record
      ProductionRecord memory record = ProductionRecord({
        producer: producers[i],
        amount: sparkAmount,
        timestamp: timestamp
      });

      allProductionRecords.push(record);
      uint256 recordId = allProductionRecords.length - 1;

      producerRecords[producers[i]].push(record);
      producerTotalProduction[producers[i]] += sparkAmount;

      // Update virtual balance
      virtualBalance[producers[i]] += sparkAmount;

      // Update aggregates
      uint256 hourKey = timestamp / 3600;
      HourlyAggregate storage hourly = hourlyAggregates[producers[i]][hourKey];
      hourly.totalAmount += sparkAmount;
      hourly.recordCount += 1;

      uint256 dayKey = timestamp / 86400;
      DailyAggregate storage daily = dailyAggregates[producers[i]][dayKey];
      daily.totalAmount += sparkAmount;
      daily.recordCount += 1;

      emit ProductionRecorded(producers[i], sparkAmount, whAmounts[i], timestamp, recordId);
    }
  }

  // Energy Offer Functions

  /**
   * @notice Creates a new energy offer for selling energy
   * @param amountWh The amount of energy to sell in Wh
   * @param pricePerKwh The price in EUR per kWh (with 8 decimals precision)
   *
   * @dev Only registered producers (who have produced energy) can create offers
   * @dev Seller must have sufficient available balance (virtual - locked)
   * @dev Locks the energy in the seller's balance
   * @dev Emits OfferCreated event
   */
  function createEnergyOffer(
    uint256 amountWh,
    uint256 pricePerKwh
  ) external validAmount(amountWh) validAmount(pricePerKwh) {
    address seller = msg.sender;

    // Check that seller is a registered producer (has produced energy)
    if (producerTotalProduction[seller] == 0) revert NotAProducer();

    // Convert Wh to SPARK tokens (smallest units)
    uint256 sparkAmount = whToSpark(amountWh);

    // Check seller has sufficient available balance
    uint256 availableBalance = virtualBalance[seller] - lockedBalance[seller];
    if (availableBalance < sparkAmount) revert InsufficientAvailableBalance();

    // Lock the balance
    lockedBalance[seller] += sparkAmount;

    // Create offer
    uint256 offerId = nextOfferId++;
    uint256 timestamp = block.timestamp;

    EnergyOffer memory offer = EnergyOffer({
      offerId: offerId,
      seller: seller,
      amountWh: amountWh,
      pricePerKwh: pricePerKwh,
      timestamp: timestamp,
      status: OfferStatus.ACTIVE
    });

    // Store offer
    allEnergyOffers.push(offer);
    sellerOfferIds[seller].push(offerId);

    // Increment active offers counter
    activeOffersCount++;

    emit OfferCreated(offerId, seller, amountWh, pricePerKwh, timestamp);
  }

  /**
   * @notice Cancels an active energy offer
   * @param offerId The ID of the offer to cancel
   *
   * @dev Only seller or owner can cancel
   * @dev Unlocks the energy in the seller's balance
   * @dev Emits OfferCancelled event
   */
  function cancelEnergyOffer(uint256 offerId) external {
    // Validate offer ID
    if (offerId >= allEnergyOffers.length) revert InvalidOfferId();

    EnergyOffer storage offer = allEnergyOffers[offerId];

    // Check offer is active
    if (offer.status != OfferStatus.ACTIVE) revert OfferNotActive();

    // Check caller is seller or owner
    if (msg.sender != offer.seller && msg.sender != owner) revert NotOfferSeller();

    // Convert Wh to SPARK tokens
    uint256 sparkAmount = whToSpark(offer.amountWh);

    // Unlock balance
    lockedBalance[offer.seller] -= sparkAmount;

    // Update offer status
    offer.status = OfferStatus.CANCELLED;

    // Decrement active offers counter
    activeOffersCount--;

    emit OfferCancelled(offerId, offer.seller, offer.amountWh, block.timestamp);
  }

  /**
   * @notice Matches an energy offer (fully or partially)
   * @param offerId The ID of the offer to match
   * @param buyer The buyer address
   * @param amountWh The amount to match in Wh
   *
   * @dev Only callable by owner
   * @dev If partial match, creates new offer with remaining amount
   * @dev Transfers energy from seller to buyer
   * @dev Emits OfferMatched and optionally OfferCompleted events
   */
  function matchEnergyOffer(
    uint256 offerId,
    address buyer,
    uint256 amountWh
  ) external onlyOwner validAddress(buyer) validAmount(amountWh) {
    // Validate offer ID
    if (offerId >= allEnergyOffers.length) revert InvalidOfferId();

    EnergyOffer storage offer = allEnergyOffers[offerId];

    // Check offer is active
    if (offer.status != OfferStatus.ACTIVE) revert OfferNotActive();

    // Check amount is not greater than offer amount
    if (amountWh > offer.amountWh) revert InvalidAmount();

    address seller = offer.seller;
    uint256 pricePerKwh = offer.pricePerKwh;
    uint256 timestamp = block.timestamp;

    // Convert Wh to SPARK tokens
    uint256 sparkAmount = whToSpark(amountWh);

    // Unlock balance from seller
    lockedBalance[seller] -= sparkAmount;

    // Transfer energy from seller to buyer (updates virtual balances)
    virtualBalance[seller] -= sparkAmount;
    virtualBalance[buyer] += sparkAmount;

    // Create transaction record
    TransactionRecord memory txRecord = TransactionRecord({
      seller: seller,
      buyer: buyer,
      amount: sparkAmount,
      timestamp: timestamp
    });

    allTransactions.push(txRecord);
    userTransactions[seller].push(txRecord);
    userTransactions[buyer].push(txRecord);

    uint256 newOfferId = 0;

    // Check if partial or full match
    if (amountWh < offer.amountWh) {
      // Partial match - create new offer with remaining amount
      uint256 remainingWh = offer.amountWh - amountWh;
      uint256 remainingSpark = whToSpark(remainingWh);

      // Lock remaining balance
      lockedBalance[seller] += remainingSpark;

      // Create new offer
      newOfferId = nextOfferId++;
      EnergyOffer memory newOffer = EnergyOffer({
        offerId: newOfferId,
        seller: seller,
        amountWh: remainingWh,
        pricePerKwh: pricePerKwh,
        timestamp: timestamp,
        status: OfferStatus.ACTIVE
      });

      allEnergyOffers.push(newOffer);
      sellerOfferIds[seller].push(newOfferId);

      // Update original offer status
      offer.status = OfferStatus.PARTIALLY_FILLED;

      // Decrement counter for partially filled, increment for new active offer (net: no change)
      activeOffersCount--;
      activeOffersCount++;

      emit OfferCreated(newOfferId, seller, remainingWh, pricePerKwh, timestamp);
    } else {
      // Full match - mark as completed
      offer.status = OfferStatus.COMPLETED;

      // Decrement active offers counter
      activeOffersCount--;

      emit OfferCompleted(offerId, seller, timestamp);
    }

    emit OfferMatched(offerId, seller, buyer, amountWh, pricePerKwh, timestamp, newOfferId);
  }

  // Energy Buy Offer Functions

  /**
   * @notice Creates a new energy buy offer
   * @param amountWh The amount of energy to purchase in Wh
   * @param maxPricePerKwh The maximum price willing to pay in EUR per kWh (with 8 decimals precision)
   *
   * @dev Anyone can create buy offers (no registration required)
   * @dev No lock of virtual balance for buyers
   * @dev Emits BuyOfferCreated event
   */
  function createEnergyBuyOffer(
    uint256 amountWh,
    uint256 maxPricePerKwh
  ) external validAmount(amountWh) validAmount(maxPricePerKwh) {
    address buyer = msg.sender;

    // Create buy offer
    uint256 offerId = nextBuyOfferId++;
    uint256 timestamp = block.timestamp;

    EnergyBuyOffer memory buyOffer = EnergyBuyOffer({
      offerId: offerId,
      buyer: buyer,
      amountWh: amountWh,
      maxPricePerKwh: maxPricePerKwh,
      timestamp: timestamp,
      status: OfferStatus.ACTIVE
    });

    // Store buy offer
    allEnergyBuyOffers.push(buyOffer);
    buyerOfferIds[buyer].push(offerId);

    // Increment active buy offers counter
    activeBuyOffersCount++;

    emit BuyOfferCreated(offerId, buyer, amountWh, maxPricePerKwh, timestamp);
  }

  /**
   * @notice Cancels an active energy buy offer
   * @param offerId The ID of the buy offer to cancel
   *
   * @dev Only buyer or owner can cancel
   * @dev Emits BuyOfferCancelled event
   */
  function cancelEnergyBuyOffer(uint256 offerId) external {
    // Validate offer ID
    if (offerId >= allEnergyBuyOffers.length) revert InvalidBuyOfferId();

    EnergyBuyOffer storage buyOffer = allEnergyBuyOffers[offerId];

    // Check offer is active
    if (buyOffer.status != OfferStatus.ACTIVE) revert BuyOfferNotActive();

    // Check caller is buyer or owner
    if (msg.sender != buyOffer.buyer && msg.sender != owner) revert NotOfferBuyer();

    // Update offer status
    buyOffer.status = OfferStatus.CANCELLED;

    // Decrement active buy offers counter
    activeBuyOffersCount--;

    emit BuyOfferCancelled(offerId, buyOffer.buyer, buyOffer.amountWh, block.timestamp);
  }

  /**
   * @notice Matches an energy buy offer with a seller (fully or partially)
   * @param offerId The ID of the buy offer to match
   * @param seller The seller address
   * @param amountWh The amount to match in Wh
   *
   * @dev Only callable by owner (VPP AI)
   * @dev If partial match, creates new buy offer with remaining amount
   * @dev Transfers energy from seller to buyer
   * @dev Seller must have sufficient available balance
   * @dev Emits BuyOfferMatched and optionally BuyOfferCompleted events
   */
  function matchEnergyBuyOffer(
    uint256 offerId,
    address seller,
    uint256 amountWh
  ) external onlyOwner validAddress(seller) validAmount(amountWh) {
    // Validate offer ID
    if (offerId >= allEnergyBuyOffers.length) revert InvalidBuyOfferId();

    EnergyBuyOffer storage buyOffer = allEnergyBuyOffers[offerId];

    // Check offer is active
    if (buyOffer.status != OfferStatus.ACTIVE) revert BuyOfferNotActive();

    // Check amount is not greater than offer amount
    if (amountWh > buyOffer.amountWh) revert InvalidAmount();

    address buyer = buyOffer.buyer;
    uint256 maxPricePerKwh = buyOffer.maxPricePerKwh;
    uint256 timestamp = block.timestamp;

    // Convert Wh to SPARK tokens
    uint256 sparkAmount = whToSpark(amountWh);

    // Check seller has sufficient available balance
    uint256 availableBalance = virtualBalance[seller] - lockedBalance[seller];
    if (availableBalance < sparkAmount) revert InsufficientAvailableBalance();

    // Transfer energy from seller to buyer (updates virtual balances)
    virtualBalance[seller] -= sparkAmount;
    virtualBalance[buyer] += sparkAmount;

    // Create transaction record
    TransactionRecord memory txRecord = TransactionRecord({
      seller: seller,
      buyer: buyer,
      amount: sparkAmount,
      timestamp: timestamp
    });

    allTransactions.push(txRecord);
    userTransactions[seller].push(txRecord);
    userTransactions[buyer].push(txRecord);

    uint256 newOfferId = 0;

    // Check if partial or full match
    if (amountWh < buyOffer.amountWh) {
      // Partial match - create new buy offer with remaining amount
      uint256 remainingWh = buyOffer.amountWh - amountWh;

      // Create new buy offer
      newOfferId = nextBuyOfferId++;
      EnergyBuyOffer memory newBuyOffer = EnergyBuyOffer({
        offerId: newOfferId,
        buyer: buyer,
        amountWh: remainingWh,
        maxPricePerKwh: maxPricePerKwh,
        timestamp: timestamp,
        status: OfferStatus.ACTIVE
      });

      allEnergyBuyOffers.push(newBuyOffer);
      buyerOfferIds[buyer].push(newOfferId);

      // Update original offer status
      buyOffer.status = OfferStatus.PARTIALLY_FILLED;

      // Decrement counter for partially filled, increment for new active offer (net: no change)
      activeBuyOffersCount--;
      activeBuyOffersCount++;

      emit BuyOfferCreated(newOfferId, buyer, remainingWh, maxPricePerKwh, timestamp);
    } else {
      // Full match - mark as completed
      buyOffer.status = OfferStatus.COMPLETED;

      // Decrement active buy offers counter
      activeBuyOffersCount--;

      emit BuyOfferCompleted(offerId, buyer, timestamp);
    }

    emit BuyOfferMatched(offerId, buyer, seller, amountWh, maxPricePerKwh, timestamp, newOfferId);
  }

  // Query Functions (View)

  /**
   * @notice Gets total production for a producer
   * @param producer The producer address
   * @return Total SPARK tokens produced
   */
  function getTotalProduction(address producer) external view returns (uint256) {
    return producerTotalProduction[producer];
  }

  /**
   * @notice Gets total production in Wh for a producer
   * @param producer The producer address
   * @return Total Wh produced
   */
  function getTotalProductionInWh(address producer) external view returns (uint256) {
    return producerTotalProduction[producer] / (10 ** DECIMALS);
  }

  /**
   * @notice Gets total production in kWh for a producer
   * @param producer The producer address
   * @return Total kWh produced
   */
  function getTotalProductionInKwh(address producer) external view returns (uint256) {
    return producerTotalProduction[producer] / (10 ** DECIMALS) / 1000;
  }

  /**
   * @notice Gets all production records for a producer
   * @param producer The producer address
   * @return Array of production records
   */
  function getProductionRecords(address producer) external view returns (ProductionRecord[] memory) {
    return producerRecords[producer];
  }

  /**
   * @notice Gets paginated production records for a producer
   * @param producer The producer address
   * @param offset Starting index
   * @param limit Number of records to return
   * @return Array of production records
   */
  function getProductionRecordsPaginated(
    address producer,
    uint256 offset,
    uint256 limit
  ) external view returns (ProductionRecord[] memory) {
    ProductionRecord[] storage records = producerRecords[producer];

    if (offset >= records.length) {
      return new ProductionRecord[](0);
    }

    uint256 end = offset + limit;
    if (end > records.length) {
      end = records.length;
    }

    uint256 resultLength = end - offset;
    ProductionRecord[] memory result = new ProductionRecord[](resultLength);

    for (uint256 i = 0; i < resultLength; i++) {
      result[i] = records[offset + i];
    }

    return result;
  }

  /**
   * @notice Gets daily production for a producer
   * @param producer The producer address
   * @param timestamp Any timestamp within the desired day
   * @return amount Total SPARK produced that day
   * @return count Number of production records that day
   */
  function getDailyProduction(
    address producer,
    uint256 timestamp
  ) external view returns (uint256 amount, uint256 count) {
    uint256 dayKey = timestamp / 86400;
    DailyAggregate storage daily = dailyAggregates[producer][dayKey];
    return (daily.totalAmount, daily.recordCount);
  }

  /**
   * @notice Gets hourly production for a producer
   * @param producer The producer address
   * @param timestamp Any timestamp within the desired hour
   * @return amount Total SPARK produced that hour
   * @return count Number of production records that hour
   */
  function getHourlyProduction(
    address producer,
    uint256 timestamp
  ) external view returns (uint256 amount, uint256 count) {
    uint256 hourKey = timestamp / 3600;
    HourlyAggregate storage hourly = hourlyAggregates[producer][hourKey];
    return (hourly.totalAmount, hourly.recordCount);
  }

  /**
   * @notice Gets production in a time range
   * @param producer The producer address
   * @param startTime Start timestamp (inclusive)
   * @param endTime End timestamp (inclusive)
   * @return Total SPARK produced in the range
   */
  function getProductionInRange(
    address producer,
    uint256 startTime,
    uint256 endTime
  ) external view returns (uint256) {
    ProductionRecord[] storage records = producerRecords[producer];
    uint256 total = 0;

    for (uint256 i = 0; i < records.length; i++) {
      if (records[i].timestamp >= startTime && records[i].timestamp <= endTime) {
        total += records[i].amount;
      }
    }

    return total;
  }

  /**
   * @notice Gets total number of production records globally
   * @return Total record count
   */
  function getTotalRecordsCount() external view returns (uint256) {
    return allProductionRecords.length;
  }

  /**
   * @notice Gets number of production records for a producer
   * @param producer The producer address
   * @return Producer's record count
   */
  function getUserRecordsCount(address producer) external view returns (uint256) {
    return producerRecords[producer].length;
  }

  /**
   * @notice Gets a specific global production record
   * @param recordId The global record ID
   * @return Production record
   */
  function getGlobalRecord(uint256 recordId) external view returns (ProductionRecord memory) {
    if (recordId >= allProductionRecords.length) revert InvalidAmount();
    return allProductionRecords[recordId];
  }

  /**
   * @notice Gets virtual balance for a user
   * @param user The user address
   * @return Virtual balance in SPARK tokens (smallest units)
   */
  function getVirtualBalance(address user) external view returns (uint256) {
    return virtualBalance[user];
  }

  /**
   * @notice Gets virtual balance in Wh for a user
   * @param user The user address
   * @return Virtual balance in Wh
   */
  function getVirtualBalanceInWh(address user) external view returns (uint256) {
    return virtualBalance[user] / (10 ** DECIMALS);
  }

  /**
   * @notice Gets virtual balance in kWh for a user
   * @param user The user address
   * @return Virtual balance in kWh
   */
  function getVirtualBalanceInKwh(address user) external view returns (uint256) {
    return virtualBalance[user] / (10 ** DECIMALS) / 1000;
  }

  /**
   * @notice Gets all transaction records for a user
   * @param user The user address
   * @return Array of transaction records
   */
  function getUserTransactions(address user) external view returns (TransactionRecord[] memory) {
    return userTransactions[user];
  }

  /**
   * @notice Gets all transaction records globally
   * @return Array of all transaction records
   */
  function getAllTransactions() external view returns (TransactionRecord[] memory) {
    return allTransactions;
  }

  /**
   * @notice Gets paginated transaction records
   * @param offset Starting index
   * @param limit Number of records to return
   * @return Array of transaction records
   */
  function getTransactionsPaginated(
    uint256 offset,
    uint256 limit
  ) external view returns (TransactionRecord[] memory) {
    if (offset >= allTransactions.length) {
      return new TransactionRecord[](0);
    }

    uint256 end = offset + limit;
    if (end > allTransactions.length) {
      end = allTransactions.length;
    }

    uint256 resultLength = end - offset;
    TransactionRecord[] memory result = new TransactionRecord[](resultLength);

    for (uint256 i = 0; i < resultLength; i++) {
      result[i] = allTransactions[offset + i];
    }

    return result;
  }

  /**
   * @notice Gets total number of transactions globally
   * @return Total transaction count
   */
  function getTotalTransactionsCount() external view returns (uint256) {
    return allTransactions.length;
  }

  /**
   * @notice Gets number of transactions for a user
   * @param user The user address
   * @return User's transaction count
   */
  function getUserTransactionsCount(address user) external view returns (uint256) {
    return userTransactions[user].length;
  }

  // Energy Offer Query Functions

  /**
   * @notice Gets all active energy offers (paginated)
   * @param offset Starting index
   * @param limit Number of records to return
   * @return Array of active energy offers
   */
  function getActiveOffers(uint256 offset, uint256 limit) external view returns (EnergyOffer[] memory) {
    // First, count active offers
    uint256 activeCount = 0;
    for (uint256 i = 0; i < allEnergyOffers.length; i++) {
      if (allEnergyOffers[i].status == OfferStatus.ACTIVE) {
        activeCount++;
      }
    }

    if (offset >= activeCount) {
      return new EnergyOffer[](0);
    }

    uint256 end = offset + limit;
    if (end > activeCount) {
      end = activeCount;
    }

    uint256 resultLength = end - offset;
    EnergyOffer[] memory result = new EnergyOffer[](resultLength);

    uint256 currentIndex = 0;
    uint256 resultIndex = 0;

    for (uint256 i = 0; i < allEnergyOffers.length && resultIndex < resultLength; i++) {
      if (allEnergyOffers[i].status == OfferStatus.ACTIVE) {
        if (currentIndex >= offset) {
          result[resultIndex] = allEnergyOffers[i];
          resultIndex++;
        }
        currentIndex++;
      }
    }

    return result;
  }

  /**
   * @notice Gets all energy offers for a specific seller (paginated)
   * @param seller The seller address
   * @param offset Starting index
   * @param limit Number of records to return
   * @return Array of energy offers
   */
  function getOffersBySeller(
    address seller,
    uint256 offset,
    uint256 limit
  ) external view returns (EnergyOffer[] memory) {
    uint256[] storage offerIds = sellerOfferIds[seller];

    if (offset >= offerIds.length) {
      return new EnergyOffer[](0);
    }

    uint256 end = offset + limit;
    if (end > offerIds.length) {
      end = offerIds.length;
    }

    uint256 resultLength = end - offset;
    EnergyOffer[] memory result = new EnergyOffer[](resultLength);

    for (uint256 i = 0; i < resultLength; i++) {
      result[i] = allEnergyOffers[offerIds[offset + i]];
    }

    return result;
  }

  /**
   * @notice Gets all energy offers globally (paginated)
   * @param offset Starting index
   * @param limit Number of records to return
   * @return Array of all energy offers
   */
  function getAllOffers(uint256 offset, uint256 limit) external view returns (EnergyOffer[] memory) {
    if (offset >= allEnergyOffers.length) {
      return new EnergyOffer[](0);
    }

    uint256 end = offset + limit;
    if (end > allEnergyOffers.length) {
      end = allEnergyOffers.length;
    }

    uint256 resultLength = end - offset;
    EnergyOffer[] memory result = new EnergyOffer[](resultLength);

    for (uint256 i = 0; i < resultLength; i++) {
      result[i] = allEnergyOffers[offset + i];
    }

    return result;
  }

  /**
   * @notice Gets a specific energy offer by ID
   * @param offerId The offer ID
   * @return The energy offer
   */
  function getOfferById(uint256 offerId) external view returns (EnergyOffer memory) {
    if (offerId >= allEnergyOffers.length) revert InvalidOfferId();
    return allEnergyOffers[offerId];
  }

  /**
   * @notice Gets locked balance for a user
   * @param user The user address
   * @return Locked balance in SPARK tokens (smallest units)
   */
  function getLockedBalance(address user) external view returns (uint256) {
    return lockedBalance[user];
  }

  /**
   * @notice Gets locked balance in Wh for a user
   * @param user The user address
   * @return Locked balance in Wh
   */
  function getLockedBalanceInWh(address user) external view returns (uint256) {
    return sparkToWh(lockedBalance[user]);
  }

  /**
   * @notice Gets locked balance in kWh for a user
   * @param user The user address
   * @return Locked balance in kWh
   */
  function getLockedBalanceInKwh(address user) external view returns (uint256) {
    return sparkToWh(lockedBalance[user]) / 1000;
  }

  /**
   * @notice Gets available balance (virtual - locked) for a user
   * @param user The user address
   * @return Available balance in SPARK tokens (smallest units)
   */
  function getAvailableBalance(address user) external view returns (uint256) {
    return virtualBalance[user] - lockedBalance[user];
  }

  /**
   * @notice Gets available balance in Wh for a user
   * @param user The user address
   * @return Available balance in Wh
   */
  function getAvailableBalanceInWh(address user) external view returns (uint256) {
    uint256 available = virtualBalance[user] - lockedBalance[user];
    return sparkToWh(available);
  }

  /**
   * @notice Gets available balance in kWh for a user
   * @param user The user address
   * @return Available balance in kWh
   */
  function getAvailableBalanceInKwh(address user) external view returns (uint256) {
    uint256 available = virtualBalance[user] - lockedBalance[user];
    return sparkToWh(available) / 1000;
  }

  /**
   * @notice Gets total number of energy offers globally
   * @return Total offer count
   */
  function getTotalOffersCount() external view returns (uint256) {
    return allEnergyOffers.length;
  }

  /**
   * @notice Gets number of energy offers for a seller
   * @param seller The seller address
   * @return Seller's offer count
   */
  function getSellerOffersCount(address seller) external view returns (uint256) {
    return sellerOfferIds[seller].length;
  }

  /**
   * @notice Gets total number of active energy offers
   * @return Active offer count
   */
  function getActiveOffersCount() external view returns (uint256) {
    return activeOffersCount;
  }

  // Energy Buy Offer Query Functions

  /**
   * @notice Gets all active energy buy offers (paginated)
   * @param offset Starting index
   * @param limit Number of records to return
   * @return Array of active energy buy offers
   */
  function getActiveBuyOffers(uint256 offset, uint256 limit) external view returns (EnergyBuyOffer[] memory) {
    // First, count active buy offers
    uint256 activeCount = 0;
    for (uint256 i = 0; i < allEnergyBuyOffers.length; i++) {
      if (allEnergyBuyOffers[i].status == OfferStatus.ACTIVE) {
        activeCount++;
      }
    }

    if (offset >= activeCount) {
      return new EnergyBuyOffer[](0);
    }

    uint256 end = offset + limit;
    if (end > activeCount) {
      end = activeCount;
    }

    uint256 resultLength = end - offset;
    EnergyBuyOffer[] memory result = new EnergyBuyOffer[](resultLength);

    uint256 currentIndex = 0;
    uint256 resultIndex = 0;

    for (uint256 i = 0; i < allEnergyBuyOffers.length && resultIndex < resultLength; i++) {
      if (allEnergyBuyOffers[i].status == OfferStatus.ACTIVE) {
        if (currentIndex >= offset) {
          result[resultIndex] = allEnergyBuyOffers[i];
          resultIndex++;
        }
        currentIndex++;
      }
    }

    return result;
  }

  /**
   * @notice Gets all energy buy offers for a specific buyer (paginated)
   * @param buyer The buyer address
   * @param offset Starting index
   * @param limit Number of records to return
   * @return Array of energy buy offers
   */
  function getBuyOffersByBuyer(
    address buyer,
    uint256 offset,
    uint256 limit
  ) external view returns (EnergyBuyOffer[] memory) {
    uint256[] storage offerIds = buyerOfferIds[buyer];

    if (offset >= offerIds.length) {
      return new EnergyBuyOffer[](0);
    }

    uint256 end = offset + limit;
    if (end > offerIds.length) {
      end = offerIds.length;
    }

    uint256 resultLength = end - offset;
    EnergyBuyOffer[] memory result = new EnergyBuyOffer[](resultLength);

    for (uint256 i = 0; i < resultLength; i++) {
      result[i] = allEnergyBuyOffers[offerIds[offset + i]];
    }

    return result;
  }

  /**
   * @notice Gets all energy buy offers globally (paginated)
   * @param offset Starting index
   * @param limit Number of records to return
   * @return Array of all energy buy offers
   */
  function getAllBuyOffers(uint256 offset, uint256 limit) external view returns (EnergyBuyOffer[] memory) {
    if (offset >= allEnergyBuyOffers.length) {
      return new EnergyBuyOffer[](0);
    }

    uint256 end = offset + limit;
    if (end > allEnergyBuyOffers.length) {
      end = allEnergyBuyOffers.length;
    }

    uint256 resultLength = end - offset;
    EnergyBuyOffer[] memory result = new EnergyBuyOffer[](resultLength);

    for (uint256 i = 0; i < resultLength; i++) {
      result[i] = allEnergyBuyOffers[offset + i];
    }

    return result;
  }

  /**
   * @notice Gets a specific energy buy offer by ID
   * @param offerId The buy offer ID
   * @return The energy buy offer
   */
  function getBuyOfferById(uint256 offerId) external view returns (EnergyBuyOffer memory) {
    if (offerId >= allEnergyBuyOffers.length) revert InvalidBuyOfferId();
    return allEnergyBuyOffers[offerId];
  }

  /**
   * @notice Gets total number of energy buy offers globally
   * @return Total buy offer count
   */
  function getTotalBuyOffersCount() external view returns (uint256) {
    return allEnergyBuyOffers.length;
  }

  /**
   * @notice Gets number of energy buy offers for a buyer
   * @param buyer The buyer address
   * @return Buyer's offer count
   */
  function getBuyerOffersCount(address buyer) external view returns (uint256) {
    return buyerOfferIds[buyer].length;
  }

  /**
   * @notice Gets total number of active energy buy offers
   * @return Active buy offer count
   */
  function getActiveBuyOffersCount() external view returns (uint256) {
    return activeBuyOffersCount;
  }

  // Internal Functions

  /**
   * @notice Internal function to mint tokens via HTS
   * @param amount The amount to mint
   */
  function _mintTokens(uint256 amount) internal {
    IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);

    bytes[] memory metadata;
    (int32 responseCode, , ) = hts.mintToken(SPARK_TOKEN_ADDRESS, uint64(amount), metadata);

    if (responseCode != HTS_SUCCESS) {
      revert TokenOperationFailed(responseCode);
    }

    emit TokensMinted(address(this), amount, block.timestamp);
  }

  /**
   * @notice Internal function to burn tokens via HTS
   * @param amount The amount to burn
   */
  function _burnTokens(uint256 amount) internal {
    IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);

    int64[] memory serialNumbers;
    (int32 responseCode, ) = hts.burnToken(SPARK_TOKEN_ADDRESS, uint64(amount), serialNumbers);

    if (responseCode != HTS_SUCCESS) {
      revert TokenOperationFailed(responseCode);
    }
  }

  /**
   * @notice Converts SPARK tokens (in smallest units) to Wh
   * @param sparkAmount Amount in SPARK tokens (smallest units)
   * @return Amount in Wh
   */
  function sparkToWh(uint256 sparkAmount) public pure returns (uint256) {
    return sparkAmount / (10 ** DECIMALS);
  }

  /**
   * @notice Converts Wh to SPARK tokens (in smallest units)
   * @param wh Amount in Wh
   * @return Amount in SPARK tokens (smallest units)
   */
  function whToSpark(uint256 wh) public pure returns (uint256) {
    return wh * (10 ** DECIMALS);
  }

  // Signature Verification Functions

  /**
   * @notice Verifies that a signature was created by the owner
   * @param producer The producer address
   * @param wh The Wh amount
   * @param deadline The deadline timestamp (must be in the future)
   * @param signature The signature bytes
   */
  function _verifySignature(
    address producer,
    uint256 wh,
    uint256 deadline,
    bytes memory signature
  ) internal view {
    // Check deadline
    if (block.timestamp > deadline) revert SignatureExpired();

    // Create message hash (includes contract address and chainId to prevent replay attacks)
    bytes32 messageHash = keccak256(abi.encodePacked(producer, wh, deadline, address(this), block.chainid));
    bytes32 ethSignedMessageHash = _getEthSignedMessageHash(messageHash);

    // Recover signer
    address signer = _recoverSigner(ethSignedMessageHash, signature);

    // Verify signer is owner
    if (signer != owner) revert InvalidSignature();
  }

  /**
   * @notice Gets the Ethereum signed message hash
   * @param messageHash The original message hash
   * @return The Ethereum signed message hash
   */
  function _getEthSignedMessageHash(bytes32 messageHash) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
  }

  /**
   * @notice Recovers the signer address from a signature
   * @param ethSignedMessageHash The Ethereum signed message hash
   * @param signature The signature bytes
   * @return The recovered signer address
   */
  function _recoverSigner(
    bytes32 ethSignedMessageHash,
    bytes memory signature
  ) internal pure returns (address) {
    if (signature.length != 65) revert InvalidSignatureLength();

    bytes32 r;
    bytes32 s;
    uint8 v;

    assembly {
      r := mload(add(signature, 32))
      s := mload(add(signature, 64))
      v := byte(0, mload(add(signature, 96)))
    }

    // Handle Ethereum's signature format (v can be 0, 1, 27, or 28)
    if (v < 27) {
      v += 27;
    }

    if (v != 27 && v != 28) revert InvalidSignatureVersion();

    return ecrecover(ethSignedMessageHash, v, r, s);
  }

  /**
   * @notice Helper function to get the message hash for signing
   * @param producer The producer address
   * @param wh The Wh amount
   * @param deadline The deadline timestamp
   * @return The message hash
   */
  function getMessageHash(
    address producer,
    uint256 wh,
    uint256 deadline
  ) public view returns (bytes32) {
    return keccak256(abi.encodePacked(producer, wh, deadline, address(this), block.chainid));
  }

  // Pyth Oracle Functions

  /**
   * @notice Gets the current EUR/USD price from Pyth oracle
   * @return price The EUR/USD price (scaled by 10^expo)
   * @return expo The exponent for the price
   * @return publishTime The timestamp when the price was published
   *
   * @dev Price needs to be interpreted as: actual_price = price * 10^expo
   * @dev Example: If price = 105123456 and expo = -8, actual price = 1.05123456 USD per EUR
   */
  function getEurUsdPrice() public view returns (int64 price, int32 expo, uint publishTime) {
    IPyth pyth = IPyth(PYTH_ORACLE_ADDRESS);
    PythStructs.Price memory priceData = pyth.getPriceNoOlderThan(EUR_USD_PRICE_FEED_ID, MAX_PRICE_AGE);

    // Validate price is positive
    if (priceData.price <= 0) revert InvalidOraclePrice();

    // Validate exponent is negative (standard for Pyth feeds)
    if (priceData.expo >= 0) revert InvalidOraclePrice();

    return (priceData.price, priceData.expo, priceData.publishTime);
  }

  /**
   * @notice Gets the current EUR/USD price with confidence interval
   * @return price The EUR/USD price (scaled by 10^expo)
   * @return conf The confidence interval
   * @return expo The exponent for the price
   * @return publishTime The timestamp when the price was published
   */
  function getEurUsdPriceWithConfidence()
    public
    view
    returns (int64 price, uint64 conf, int32 expo, uint publishTime)
  {
    IPyth pyth = IPyth(PYTH_ORACLE_ADDRESS);
    PythStructs.Price memory priceData = pyth.getPriceNoOlderThan(EUR_USD_PRICE_FEED_ID, MAX_PRICE_AGE);

    // Validate price is positive
    if (priceData.price <= 0) revert InvalidOraclePrice();

    // Validate exponent is negative (standard for Pyth feeds)
    if (priceData.expo >= 0) revert InvalidOraclePrice();

    return (priceData.price, priceData.conf, priceData.expo, priceData.publishTime);
  }

  /**
   * @notice Gets EUR/USD price that is no older than specified age
   * @param maxAge Maximum age of price in seconds
   * @return price The EUR/USD price (scaled by 10^expo)
   * @return expo The exponent for the price
   * @return publishTime The timestamp when the price was published
   *
   * @dev Reverts if price is older than maxAge seconds
   */
  function getEurUsdPriceNoOlderThan(
    uint maxAge
  ) public view returns (int64 price, int32 expo, uint publishTime) {
    IPyth pyth = IPyth(PYTH_ORACLE_ADDRESS);
    PythStructs.Price memory priceData = pyth.getPriceNoOlderThan(EUR_USD_PRICE_FEED_ID, maxAge);

    // Validate price is positive
    if (priceData.price <= 0) revert InvalidOraclePrice();

    // Validate exponent is negative (standard for Pyth feeds)
    if (priceData.expo >= 0) revert InvalidOraclePrice();

    return (priceData.price, priceData.expo, priceData.publishTime);
  }

  // Grid Energy Price Functions

  function setGridEnergyPrice(uint256 priceInEuroPerKwh) external onlyOwner validAmount(priceInEuroPerKwh) {
    gridEnergyPriceEUR = priceInEuroPerKwh;
    lastGridPriceUpdate = block.timestamp;

    (int64 eurUsdPrice, int32 expo, ) = getEurUsdPrice();

    // Calculate USD price with safe math (exponent is validated as negative in getEurUsdPrice)
    uint256 multiplier = 10 ** uint32(-expo);
    uint256 priceInUSD = (priceInEuroPerKwh * uint256(int256(eurUsdPrice))) / multiplier;

    emit GridEnergyPriceUpdated(priceInEuroPerKwh, priceInUSD, eurUsdPrice, block.timestamp);
  }

  function getGridEnergyPriceEUR() public view returns (uint256 priceEUR, uint256 lastUpdate) {
    return (gridEnergyPriceEUR, lastGridPriceUpdate);
  }

  function getGridEnergyPriceUSD()
    public
    view
    returns (uint256 priceUSD, int64 eurUsdRate, int32 expo, uint256 lastUpdate)
  {
    (int64 eurUsdPrice, int32 expoValue, ) = getEurUsdPrice();

    // Calculate USD price with safe math (exponent is validated as negative in getEurUsdPrice)
    uint256 multiplier = 10 ** uint32(-expoValue);
    uint256 priceInUSD = (gridEnergyPriceEUR * uint256(int256(eurUsdPrice))) / multiplier;

    return (priceInUSD, eurUsdPrice, expoValue, lastGridPriceUpdate);
  }
}
