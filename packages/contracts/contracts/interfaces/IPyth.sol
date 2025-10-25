// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import "./PythStructs.sol";

/// @title IPyth interface for consuming Pyth price feeds
/// @notice Interface for interacting with Pyth Network oracle
interface IPyth {
  /// @notice Returns the period (in seconds) that a price feed is considered valid since its publish time
  function getValidTimePeriod() external view returns (uint validTimePeriod);

  /// @notice Returns the price and confidence interval.
  /// @dev Reverts if the price has not been updated within the last getValidTimePeriod() seconds.
  /// @param id The Pyth Price Feed ID of which to fetch the price and confidence interval.
  /// @return price - please read the documentation of PythStructs.Price to understand how to use this safely.
  function getPrice(bytes32 id) external view returns (PythStructs.Price memory price);

  /// @notice Returns the exponentially-weighted moving average price and confidence interval.
  /// @dev Reverts if the EMA price is not available.
  /// @param id The Pyth Price Feed ID of which to fetch the EMA price and confidence interval.
  /// @return price - please read the documentation of PythStructs.Price to understand how to use this safely.
  function getEmaPrice(bytes32 id) external view returns (PythStructs.Price memory price);

  /// @notice Returns the price that is no older than `age` seconds of the current time.
  /// @dev This function is a sanity-checked version of `getPriceUnsafe` which is useful in
  /// applications that require a sufficiently-recent price. Reverts if the price wasn't updated sufficiently
  /// recently.
  /// @return price - please read the documentation of PythStructs.Price to understand how to use this safely.
  function getPriceNoOlderThan(bytes32 id, uint age) external view returns (PythStructs.Price memory price);

  /// @notice Returns the price of a price feed without any sanity checks.
  /// @dev This function returns the most recent price update in this contract without any recency checks.
  /// This function is unsafe as the returned price update may be arbitrarily far in the past.
  ///
  /// Users of this function should check the `publishTime` in the price to ensure that the returned price is
  /// sufficiently recent for their application. If you are considering using this function, it may be
  /// safer / easier to use either `getPrice` or `getPriceNoOlderThan`.
  /// @return price - please read the documentation of PythStructs.Price to understand how to use this safely.
  function getPriceUnsafe(bytes32 id) external view returns (PythStructs.Price memory price);

  /// @notice Update price feeds with given update messages.
  /// This method requires the caller to pay a fee in wei; the required fee can be computed by calling
  /// `getUpdateFee` with the length of the `updateData` array.
  /// Prices will be updated if they are more recent than the current stored prices.
  /// The call will succeed even if the update is not the most recent.
  /// @dev Reverts if the transferred fee is not sufficient or the updateData is invalid.
  /// @param updateData Array of price update data.
  function updatePriceFeeds(bytes[] calldata updateData) external payable;

  /// @notice Returns the required fee to update an array of price updates.
  /// @param updateData Array of price update data.
  /// @return feeAmount The required fee in Wei.
  function getUpdateFee(bytes[] calldata updateData) external view returns (uint feeAmount);
}
