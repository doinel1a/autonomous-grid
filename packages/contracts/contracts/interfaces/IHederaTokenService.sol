// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IHederaTokenService
 * @notice Interface for interacting with Hedera Token Service (HTS) precompiled contract
 * @dev HTS precompiled contract address: 0x0000000000000000000000000000000000000167
 * @dev HTS response code for success: 22
 */
interface IHederaTokenService {

  /**
   * @notice Mints tokens to the treasury account
   * @param token The token address
   * @param amount The amount to mint (uint64)
   * @param metadata Token metadata (empty array for fungible tokens)
   * @return responseCode The response code from HTS
   * @return newTotalSupply The new total supply
   * @return serialNumbers Serial numbers for NFTs (empty for fungible)
   */
  function mintToken(
    address token,
    uint64 amount,
    bytes[] memory metadata
  ) external returns (int32 responseCode, uint64 newTotalSupply, int64[] memory serialNumbers);

  /**
   * @notice Burns tokens from the treasury account
   * @param token The token address
   * @param amount The amount to burn (uint64)
   * @param serialNumbers Serial numbers for NFTs (empty for fungible)
   * @return responseCode The response code from HTS
   * @return newTotalSupply The new total supply
   */
  function burnToken(
    address token,
    uint64 amount,
    int64[] memory serialNumbers
  ) external returns (int32 responseCode, uint64 newTotalSupply);

  /**
   * @notice Transfers tokens from one account to another
   * @param token The token address
   * @param from The sender address
   * @param to The receiver address
   * @param amount The amount to transfer
   * @return responseCode The response code from HTS
   */
  function transferToken(
    address token,
    address from,
    address to,
    int64 amount
  ) external returns (int32 responseCode);

  /**
   * @notice Associates tokens with an account
   * @param account The account to associate
   * @param tokens Array of token addresses to associate
   * @return responseCode The response code from HTS
   */
  function associateTokens(
    address account,
    address[] memory tokens
  ) external returns (int32 responseCode);

  /**
   * @notice Gets token info
   * @param token The token address
   * @return responseCode The response code
   * @return tokenInfo Token information struct
   */
  function getTokenInfo(address token) external returns (int32 responseCode, TokenInfo memory tokenInfo);

  struct TokenInfo {
    address token;
    uint64 totalSupply;
    bool deleted;
    bool defaultKycStatus;
    bool pauseStatus;
    // Additional fields exist but simplified for our use case
  }
}
