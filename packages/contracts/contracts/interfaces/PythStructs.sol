// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

/// @title PythStructs for Pyth Network price feeds
library PythStructs {
  /// @notice Represents a price with confidence interval
  /// @dev Use the price +- conf as a confidence interval for the price
  struct Price {
    // Price (in units of 10^expo)
    int64 price;
    // Confidence interval around the price
    uint64 conf;
    // Price exponent (how to interpret price value)
    int32 expo;
    // Unix timestamp describing when the price was published
    uint publishTime;
  }

  /// @notice Represents a price feed with metadata
  struct PriceFeed {
    // The price ID
    bytes32 id;
    // The current price information
    Price price;
    // The exponentially-weighted moving average price
    Price emaPrice;
  }
}
