//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import {console} from "hardhat/console.sol";
import {ERC721Events} from "./lib/ERC721Events.sol";
import {ERC20Events} from "./lib/ERC20Events.sol";

abstract contract Ownable {
  event OwnershipTransferred(address indexed user, address indexed newOwner);

  error Unauthorized();
  error InvalidOwner();

  address public owner;

  modifier onlyOwner() virtual {
    if (msg.sender != owner) revert Unauthorized();

    _;
  }

  constructor(address _owner) {
    if (_owner == address(0)) revert InvalidOwner();

    owner = _owner;

    emit OwnershipTransferred(address(0), _owner);
  }

  function transferOwnership(address _owner) public virtual onlyOwner {
    if (_owner == address(0)) revert InvalidOwner();

    owner = _owner;

    emit OwnershipTransferred(msg.sender, _owner);
  }

  function revokeOwnership() public virtual onlyOwner {
    owner = address(0);

    emit OwnershipTransferred(msg.sender, address(0));
  }
}

abstract contract ERC721Receiver {
  function onERC721Received(
    address,
    address,
    uint256,
    bytes calldata
  ) external virtual returns (bytes4) {
    return ERC721Receiver.onERC721Received.selector;
  }
}

/// @notice ERC404
///         A gas-efficient, mixed ERC20 / ERC721 implementation
///         with native liquidity and fractionalization.
///
///         This is an experimental standard designed to integrate
///         with pre-existing ERC20 / ERC721 support as smoothly as
///         possible.
///
/// @dev    In order to support full functionality of ERC20 and ERC721
///         supply assumptions are made that slightly constraint usage.
///         Ensure decimals are sufficiently large (standard 18 recommended)
///         as ids are effectively encoded in the lowest range of amounts.
///
///         NFTs are spent on ERC20 functions in a FILO queue, this is by
///         design.
///
abstract contract ERC404Legacy is Ownable {
  // Errors
  error NotFound();
  error AlreadyExists();
  error InvalidRecipient();
  error InvalidSender();
  error UnsafeRecipient();

  // Metadata
  /// @dev Token name
  string public name;

  /// @dev Token symbol
  string public symbol;

  /// @dev Decimals for fractional representation
  uint8 public immutable decimals;

  uint public immutable unit;

  /// @dev Total supply in fractionalized representation
  uint256 public immutable totalSupply;

  /// @dev Current mint counter, monotonically increasing to ensure accurate ownership
  uint256 public minted;

  // Mappings
  /// @dev Balance of user in fractional representation
  mapping(address => uint256) internal _balanceOf;

  /// @dev Allowance of user in fractional representation
  mapping(address => mapping(address => uint256)) public allowance;

  /// @dev Approval in native representaion
  mapping(uint256 => address) public getApproved;

  /// @dev Approval for all in native representation
  mapping(address => mapping(address => bool)) public isApprovedForAll;

  /// @dev Owner of id in native representation
  mapping(uint256 => address) internal _ownerOf;

  /// @dev Array of owned ids in native representation
  mapping(address => uint256[]) internal _owned;

  /// @dev Tracks indices for the _owned mapping
  mapping(uint256 => uint256) internal _ownedIndex;

  /// @dev Addresses whitelisted from minting / burning for gas savings (pairs, routers, etc)
  mapping(address => bool) public whitelist;

  // Constructor
  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    uint256 _totalNativeSupply,
    address _owner
  ) Ownable(_owner) {
    name = _name;
    symbol = _symbol;
    decimals = _decimals;
    totalSupply = _totalNativeSupply * (10 ** decimals);
    unit = 10 ** _decimals;
  }

  /// @notice Initialization function to set pairs / etc
  ///         saving gas by avoiding mint / burn on unnecessary targets
  function setWhitelist(address target, bool state) public onlyOwner {
    whitelist[target] = state;
  }

  /// @notice Function to find owner of a given native token
     function ownerOf(uint256 id) public view virtual returns (address owner) {
    owner = _ownerOf[id];

    if (owner == address(0)) {
      revert NotFound();
    }
  }

  /// @notice tokenURI must be implemented by child contract
  function tokenURI(uint256 id) public view virtual returns (string memory);

  /// @notice Function for token approvals
  /// @dev This function assumes id / native if amount less than or equal to current max id
  function approve(
    address spender,
    uint256 amountOrId
  ) public virtual returns (bool) {
    if (amountOrId <= minted && amountOrId > 0) {
      address owner = _ownerOf[amountOrId];

      if (msg.sender != owner && !isApprovedForAll[owner][msg.sender]) {
        revert Unauthorized();
      }

      getApproved[amountOrId] = spender;

      emit ERC721Events.Approval(owner, spender, amountOrId);
    } else {
      allowance[msg.sender][spender] = amountOrId;

      emit ERC20Events.Approval(msg.sender, spender, amountOrId);
    }

    return true;
  }

  /// @notice Function native approvals
  function setApprovalForAll(address operator, bool approved) public virtual {
    isApprovedForAll[msg.sender][operator] = approved;

    emit ERC721Events.ApprovalForAll(msg.sender, operator, approved);
  }

  /// @notice Function for mixed transfers
  /// @dev This function assumes id / native if amount less than or equal to current max id
  function transferFrom(
    address from,
    address to,
    uint256 amountOrId
  ) public virtual {
    if (amountOrId <= minted) {
      if (from != _ownerOf[amountOrId]) {
        revert InvalidSender();
      }

      if (to == address(0)) {
        revert InvalidRecipient();
      }

      if (
        msg.sender != from &&
        !isApprovedForAll[from][msg.sender] &&
        msg.sender != getApproved[amountOrId]
      ) {
        revert Unauthorized();
      }

      _balanceOf[from] -= unit;

      unchecked {
        _balanceOf[to] += unit;
      }

      _ownerOf[amountOrId] = to;
      delete getApproved[amountOrId];

      // update _owned for sender
      uint256 updatedId = _owned[from][_owned[from].length - 1];
      _owned[from][_ownedIndex[amountOrId]] = updatedId;
      // pop
      _owned[from].pop();
      // update index for the moved id
      _ownedIndex[updatedId] = _ownedIndex[amountOrId];
      // push token to owned
      _owned[to].push(amountOrId);
      // update index for to owned
      _ownedIndex[amountOrId] = _owned[to].length - 1;

      emit ERC721Events.Transfer(from, to, amountOrId);
      emit ERC20Events.Transfer(from, to, unit);
    } else {
      uint256 allowed = allowance[from][msg.sender];

      if (allowed != type(uint256).max)
        allowance[from][msg.sender] = allowed - amountOrId;

      _transfer(from, to, amountOrId);
    }
  }

  /// @notice Function for fractional transfers
  function transfer(address to, uint256 amount) public virtual returns (bool) {
    return _transfer(msg.sender, to, amount);
  }

  /// @notice Function for native transfers with contract support
  function safeTransferFrom(
    address from,
    address to,
    uint256 id
  ) public virtual {
    transferFrom(from, to, id);

    if (
      to.code.length != 0 &&
      ERC721Receiver(to).onERC721Received(msg.sender, from, id, "") !=
      ERC721Receiver.onERC721Received.selector
    ) {
      revert UnsafeRecipient();
    }
  }

  /// @notice Function for native transfers with contract support and callback data
  function safeTransferFrom(
    address from,
    address to,
    uint256 id,
    bytes calldata data
  ) public virtual {
    transferFrom(from, to, id);

    if (
      to.code.length != 0 &&
      ERC721Receiver(to).onERC721Received(msg.sender, from, id, data) !=
      ERC721Receiver.onERC721Received.selector
    ) {
      revert UnsafeRecipient();
    }
  }

  /// @notice Internal function for fractional transfers
  function _transfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual returns (bool) {
    uint256 balanceBeforeSender = _balanceOf[from];
    uint256 balanceBeforeReceiver = _balanceOf[to];

    _balanceOf[from] -= amount;

    unchecked {
      _balanceOf[to] += amount;
    }

    // Skip burn for certain addresses to save gas
    if (!whitelist[from]) {
      uint256 tokensToBurn = (balanceBeforeSender / unit) -
        (_balanceOf[from] / unit);
      for (uint256 i = 0; i < tokensToBurn; i++) {
        _burn(from);
      }
    }

    // Skip minting for certain addresses to save gas
    if (!whitelist[to]) {
      uint256 tokensToMint = (_balanceOf[to] / unit) -
        (balanceBeforeReceiver / unit);
      for (uint256 i = 0; i < tokensToMint; i++) {
        _mint(to);
      }
    }

    emit ERC20Events.Transfer(from, to, amount);
    return true;
  }

  function _mint(address to) internal virtual {
    if (to == address(0)) {
      revert InvalidRecipient();
    }

    unchecked {
      minted++;
    }

    uint256 id = minted;

    if (_ownerOf[id] != address(0)) {
      revert AlreadyExists();
    }

    _ownerOf[id] = to;
    _owned[to].push(id);
    _ownedIndex[id] = _owned[to].length - 1;

    emit ERC721Events.Transfer(address(0), to, id);
  }

  function _burn(address from) internal virtual {
    if (from == address(0)) {
      revert InvalidSender();
    }

    uint256 id = _owned[from][_owned[from].length - 1];
    _owned[from].pop();
    delete _ownedIndex[id];
    delete _ownerOf[id];
    delete getApproved[id];

    emit ERC721Events.Transfer(from, address(0), id);
  }

  function _setNameSymbol(string memory _name, string memory _symbol) internal {
    name = _name;
    symbol = _symbol;
  }
}
