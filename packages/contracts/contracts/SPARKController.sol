// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./interfaces/IHederaTokenService.sol";
import "./interfaces/IPyth.sol";
import "./interfaces/PythStructs.sol";

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
  address constant HTS_PRECOMPILE = 0x0000000000000000000000000000000000000167;

  /// @notice HTS response codes
  int32 constant HTS_SUCCESS = 22;

  /// @notice Pyth Network EUR/USD price feed ID
  bytes32 public constant EUR_USD_PRICE_FEED_ID = 0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b;

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
   * @notice Test function to check HTS mint response code without reverting
   * @dev Only callable by owner, for debugging purposes
   * @return The response code from HTS mint call
   */
  function testMintToken(uint256 amount) external onlyOwner returns (int32) {
    IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);

    bytes[] memory metadata;
    (int32 responseCode, , ) = hts.mintToken(SPARK_TOKEN_ADDRESS, uint64(amount), metadata);

    return responseCode;
  }

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
    // Check seller has sufficient virtual balance
    if (virtualBalance[seller] < amount) revert InsufficientVirtualBalance();

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
    // Check consumer has sufficient virtual balance
    if (virtualBalance[consumer] < amount) revert InsufficientVirtualBalance();

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

    // Create message hash
    bytes32 messageHash = keccak256(abi.encodePacked(producer, wh, deadline));
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
    require(signature.length == 65, "Invalid signature length");

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

    require(v == 27 || v == 28, "Invalid signature version");

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
  ) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(producer, wh, deadline));
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
    PythStructs.Price memory priceData = pyth.getPriceUnsafe(EUR_USD_PRICE_FEED_ID);

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
    PythStructs.Price memory priceData = pyth.getPriceUnsafe(EUR_USD_PRICE_FEED_ID);

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

    return (priceData.price, priceData.expo, priceData.publishTime);
  }
}
