// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title TestToken
 * @notice A basic ERC-20 token implementation with enhanced security features
 * @dev Implements standard ERC-20 functions with custom errors for gas efficiency
 */
contract TestToken {
  /// @notice The name of the token
  string public name = 'D1A';

  /// @notice The symbol of the token
  string public symbol = 'D1A';

  /// @notice The number of decimals the token uses
  uint8 public decimals = 18;

  /// @notice The total supply of tokens
  uint256 public totalSupply;

  /// @notice Mapping from address to token balance
  mapping(address => uint256) public balanceOf;

  /// @notice Mapping from owner to spender to approved amount
  /// @dev allowance[owner][spender] = amount
  mapping(address => mapping(address => uint256)) public allowance;

  /// @notice Emitted when tokens are transferred from one address to another
  /// @param from The address tokens are transferred from
  /// @param to The address tokens are transferred to
  /// @param amount The amount of tokens transferred
  event Transfer(address indexed from, address indexed to, uint256 indexed amount);

  /// @notice Emitted when an approval is granted or modified
  /// @param owner The address granting the approval
  /// @param spender The address receiving the approval
  /// @param amount The amount of tokens approved
  event Approval(address indexed owner, address indexed spender, uint256 indexed amount);

  /// @notice Thrown when an account has insufficient balance for an operation
  /// @param available The actual balance available
  /// @param required The required balance for the operation
  error InsufficientBalance(uint256 available, uint256 required);

  /// @notice Thrown when an account has insufficient allowance for an operation
  /// @param available The actual allowance available
  /// @param required The required allowance for the operation
  error InsufficientAllowance(uint256 available, uint256 required);

  /// @notice Thrown when attempting to interact with the zero address
  error ZeroAddressNotAllowed();

  /// @notice Thrown when an allowance increase would cause an overflow
  error AllowanceOverflow();

  /**
   * @notice Creates a new TestToken with an initial supply
   * @param _initialSupply The initial supply of tokens (will be multiplied by 10^decimals)
   * @dev The entire supply is minted to the contract deployer
   */
  constructor(uint256 _initialSupply) {
    totalSupply = _initialSupply * 10 ** uint256(decimals);
    balanceOf[msg.sender] = totalSupply;
    emit Transfer(address(0), msg.sender, totalSupply);
  }

  /**
   * @notice Transfers tokens from the caller's account to another address
   * @param _to The address to transfer tokens to
   * @param _amount The amount of tokens to transfer
   * @return success True if the transfer was successful
   * @dev Reverts if recipient is zero address or sender has insufficient balance
   */
  function transfer(address _to, uint256 _amount) public returns (bool success) {
    if (_to == address(0)) {
      revert ZeroAddressNotAllowed();
    }

    if (balanceOf[msg.sender] < _amount) {
      revert InsufficientBalance(balanceOf[msg.sender], _amount);
    }

    balanceOf[msg.sender] -= _amount;
    balanceOf[_to] += _amount;

    emit Transfer(msg.sender, _to, _amount);
    return true;
  }

  /**
   * @notice Approves a spender to spend tokens on behalf of the caller
   * @param _spender The address authorized to spend tokens
   * @param _amount The amount of tokens approved for spending
   * @return success True if the approval was successful
   * @dev Reverts if spender is zero address
   * @dev Warning: Changing an allowance with this method has race condition risk.
   *      Consider using increaseAllowance or decreaseAllowance instead.
   */
  function approve(address _spender, uint256 _amount) public returns (bool success) {
    if (_spender == address(0)) {
      revert ZeroAddressNotAllowed();
    }

    allowance[msg.sender][_spender] = _amount;

    emit Approval(msg.sender, _spender, _amount);
    return true;
  }

  /**
   * @notice Transfers tokens from one address to another using an allowance
   * @param _from The address to transfer tokens from
   * @param _to The address to transfer tokens to
   * @param _amount The amount of tokens to transfer
   * @return success True if the transfer was successful
   * @dev Requires the caller to have sufficient allowance from the _from address
   * @dev Reverts if sender or recipient is zero address, insufficient balance, or insufficient allowance
   * @dev The allowance is decreased by the transfer amount
   */
  function transferFrom(address _from, address _to, uint256 _amount) public returns (bool success) {
    if (_from == address(0) || _to == address(0)) {
      revert ZeroAddressNotAllowed();
    }

    if (balanceOf[_from] < _amount) {
      revert InsufficientBalance(balanceOf[_from], _amount);
    }

    if (allowance[_from][msg.sender] < _amount) {
      revert InsufficientAllowance(allowance[_from][msg.sender], _amount);
    }

    balanceOf[_from] -= _amount;
    balanceOf[_to] += _amount;
    allowance[_from][msg.sender] -= _amount;

    emit Transfer(_from, _to, _amount);
    return true;
  }

  /**
   * @notice Atomically increases the allowance granted to a spender
   * @param _spender The address whose allowance will be increased
   * @param _addedAmount The amount to add to the current allowance
   * @return success True if the operation was successful
   * @dev This is a safer alternative to approve() that prevents race conditions
   * @dev Reverts if spender is zero address or if the operation would cause an overflow
   */
  function increaseAllowance(address _spender, uint256 _addedAmount) public returns (bool success) {
    if (_spender == address(0)) {
      revert ZeroAddressNotAllowed();
    }

    uint256 currentAllowance = allowance[msg.sender][_spender];
    uint256 newAllowance = currentAllowance + _addedAmount;

    if (newAllowance < currentAllowance) {
      revert AllowanceOverflow();
    }

    allowance[msg.sender][_spender] = newAllowance;

    emit Approval(msg.sender, _spender, newAllowance);
    return true;
  }

  /**
   * @notice Atomically decreases the allowance granted to a spender
   * @param _spender The address whose allowance will be decreased
   * @param _subtractedAmount The amount to subtract from the current allowance
   * @return success True if the operation was successful
   * @dev This is a safer alternative to approve() that prevents race conditions
   * @dev Reverts if spender is zero address or if the current allowance is less than the subtracted amount
   */
  function decreaseAllowance(
    address _spender,
    uint256 _subtractedAmount
  ) public returns (bool success) {
    if (_spender == address(0)) {
      revert ZeroAddressNotAllowed();
    }

    uint256 currentAllowance = allowance[msg.sender][_spender];

    if (currentAllowance < _subtractedAmount) {
      revert InsufficientAllowance(currentAllowance, _subtractedAmount);
    }

    allowance[msg.sender][_spender] = currentAllowance - _subtractedAmount;

    emit Approval(msg.sender, _spender, currentAllowance - _subtractedAmount);
    return true;
  }

  /**
   * @notice Retrieves account balance and total supply information
   * @param _owner The address to query the balance of
   * @return balance The token balance of the specified address
   * @return supply The total supply of tokens
   * @dev This is a convenience function that returns both values in a single call
   */
  function getAccountInfo(address _owner) public view returns (uint256 balance, uint256 supply) {
    return (balanceOf[_owner], totalSupply);
  }
}
