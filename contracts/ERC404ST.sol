//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC404Legacy} from "./ERC404Legacy.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {ERC5169} from "stl-contracts/ERC/ERC5169.sol";
// import {console} from "hardhat/console.sol";

// nuance - user can't transfer to other account and back ERC20
// tokens to generate new NFTs. User Address has solid predictable NFT list

contract ERC404ST is ERC5169, ERC404Legacy {
    using EnumerableSet for EnumerableSet.UintSet;

    // save list of ERC721 tokens to stay them solid, block from spliting to ERC20
    // list of own Solidified tokens
    // owner -> ids[]
    mapping(address => EnumerableSet.UintSet) private _solidified;
    // list of Solidified tokens, sent to other accounts
    // owner -> ids[]
    mapping(address => uint256[]) public ownSentSolidified;
    // list of Solidified tokens, minted for other account
    // owner -> ids[]
    mapping(address => uint256[]) public receivedSolidified;

    /// @dev TokenId packed next way: [address ¹⁶⁰] [sequentialID⁹⁶] bit 1 - bit 160 - walletAddress, which minted the token, bit 161 - 256 - sequence number of minted token in wallet

    uint256 private constant _MAX_AMOUNT = (1 << 96) - 1;

    event Solidified(uint tokenId, address requestor);
    event UnSolidified(uint tokenId, address requestor);

    function _authorizeSetScripts(string[] memory) internal override onlyOwner {}

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalNativeSupply,
        address _owner
    ) ERC404Legacy(_name, _symbol, _decimals, _totalNativeSupply, _owner) {
        balanceOf[_owner] = totalSupply;
        whitelist[_owner] = true;
    }

    function tokenURI(uint256 id_) public pure override returns (string memory) {
        return string.concat("https://to.be.changed.com/token/", Strings.toString(id_));
    }

    // add token to the solidified array
    function solidify(uint256 id) public {
        if (_ownerOf[id] != address(0)) {
            revert("Already solidified");
        }
        address owner = _getMallableOwner(id);
        if (owner == address(0)) {
            revert("Token doesnt exists");
        }

        if (owner != msg.sender) {
            // TODO check if owner is approved
            revert("Not owner nor approved");
        }
        _solidified[owner].add(id);
        emit Solidified(id, msg.sender);

        _ownerOf[id] = msg.sender;

        // push token to owned
        _owned[msg.sender].push(id);
        // update index for to owned
        _ownedIndex[id] = _owned[msg.sender].length - 1;
    }

    function solidifiedTotal(address addr) public view returns (uint256) {
        return _solidified[addr].length();
    }

    function ownedTotal(address addr) public view returns (uint256) {
        return _owned[addr].length;
    }

    // remove token to the solidified array
    function unSolidify(uint id) public {
        // msg.sender must be an owner or approved

        address currentOwner = _ownerOf[id];
        if (currentOwner == address(0)) {
            revert("Not solidified");
        }

        _solidified[msg.sender].remove(id);
        emit UnSolidified(id, msg.sender);

        uint index = _ownedIndex[id];
        if (index != _owned[msg.sender].length - 1) {
            _owned[msg.sender][index] = _owned[msg.sender][_owned[msg.sender].length - 1];
        }
        _owned[msg.sender].pop();
        delete _ownedIndex[id];
        delete _ownerOf[id];

        (address owner, ) = _decodeOwnerAndId(id);
        if (owner != currentOwner) {
            // tokenId will be changed, so need to clear getApproved for current tokenId
            delete getApproved[id];
        }
    }

    // TODO remove
    function encodeOwnerAndId(address owner, uint mallableId) public pure returns (uint id) {
        return _encodeOwnerAndId(owner, mallableId);
    }

    function _encodeOwnerAndId(address owner, uint mallableId) internal pure returns (uint id) {
        require(mallableId < _MAX_AMOUNT, "Too high mallable ID");
        id = ((uint256(uint160(owner))) << 96) | mallableId;
    }

    // TODO remove
    function decodeOwnerAndId(uint id) public pure returns (address owner, uint mallableId) {
        (owner, mallableId) = _decodeOwnerAndId(id);
    }

    function _decodeOwnerAndId(uint id) internal pure returns (address owner, uint mallableId) {
        if (id < _MAX_AMOUNT) {
            revert("Invalid token ID");
        }
        mallableId = id & _MAX_AMOUNT;
        owner = address(uint160((id >> 96)));
    }

    function _getMallableOwner(uint id_) internal view returns (address) {
        (address owner, uint id) = _decodeOwnerAndId(id_);

        uint mallableNumber = balanceOf[owner] / _getUnit() - _owned[owner].length;

        if (mallableNumber == 0) {
            return address(0);
        }

        uint mallableCounter = 0;
        for (uint i = 0; i <= id; ++i) {
            if (_solidified[owner].contains(i)) {
                mallableCounter++;
            }
        }
        if (mallableCounter > mallableNumber) {
            return address(0);
        }

        return owner;
    }

    function ownerOf(uint256 id_) public view override returns (address) {
        // TODO check if id_ is owned by erc721 (solified)
        address erc721owner = _ownerOf[id_];
        if (erc721owner != address(0)) {
            return erc721owner;
        }
        address mallableOwner = _getMallableOwner(id_);
        if (mallableOwner != address(0)) {
            return mallableOwner;
        }
        revert("Mallable Token not found");
    }

    /// @notice Function for mixed transfers
    /// @dev This function assumes id / native if amount less than or equal to current max id
    function transferFrom(address from, address to, uint256 amountOrId) public virtual override {
        if (amountOrId > _MAX_AMOUNT) {
            address ownedOwner = _ownerOf[amountOrId];
            if (ownedOwner == address(0)) {
                address mallableOwner = _getMallableOwner(amountOrId);
                // ownership will be verified few lines below
                if (mallableOwner != from) {
                    revert InvalidSender();
                }
                solidify(amountOrId);
            }
            if (from != _ownerOf[amountOrId]) {
                revert InvalidSender();
            }

            if (to == address(0)) {
                revert InvalidRecipient();
            }

            if (msg.sender != from && !isApprovedForAll[from][msg.sender] && msg.sender != getApproved[amountOrId]) {
                revert Unauthorized();
            }

            balanceOf[from] -= _getUnit();

            unchecked {
                balanceOf[to] += _getUnit();
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

            emit Transfer(from, to, amountOrId);
            emit ERC20Transfer(from, to, _getUnit());
        } else {
            if (msg.sender != from) {
                uint256 allowed = allowance[from][msg.sender];

                if (allowed < amountOrId) {
                    revert("Not allowed to transfer");
                }

                if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amountOrId;
            }

            _transfer(from, to, amountOrId);
        }
    }

    /// @notice Internal function for fractional transfers (erc20)
    function _transfer(address from, address to, uint256 amount) internal override returns (bool) {
        require(amount <= _MAX_AMOUNT, "Its ID, not amount");
        uint256 unit = _getUnit();
        uint256 balanceBeforeSender = balanceOf[from];
        if (balanceBeforeSender < amount) {
            revert("Insufficient balance");
        }
        uint256 balanceBeforeReceiver = balanceOf[to];

        balanceOf[from] -= amount;

        unchecked {
            balanceOf[to] += amount;
        }

        uint totalERC721OfOwner = balanceBeforeSender / unit;
        uint mallableNumber = totalERC721OfOwner - _owned[from].length;
        // Skip burn for certain addresses to save gas
        if (!whitelist[from]) {
            // have to emit Transfer event for OpenSea and other services
            uint256 tokensToBurn = (balanceBeforeSender / unit) - (balanceOf[from] / unit);
            if (tokensToBurn > mallableNumber) {
                revert("unsolidify tokens before transfer erc20");
            }
            // start from number of tokens + number of solidified tokens - balance
            if (tokensToBurn > 0) {
                for (
                    uint256 i = totalERC721OfOwner + _solidified[from].length() - _owned[from].length;
                    tokensToBurn > 0;
                    i--
                ) {
                    // i - 1 because zero token ID exists
                    if (!_solidified[from].contains(encodeOwnerAndId(from,i - 1))) {
                        tokensToBurn--;
                        emit Transfer(from, address(0), encodeOwnerAndId(from, i - 1));
                    }
                }
            }
        }

        // Skip minting for certain addresses to save gas
        if (!whitelist[to]) {
            // emit Transfer event for OpenSea and other services
            mallableNumber = balanceBeforeReceiver / unit - _owned[to].length;

            uint256 tokensToMint = (balanceOf[to] / unit) - (balanceBeforeReceiver / unit);
            bool check;
            if (tokensToMint > 0) {
                for (uint256 i = mallableNumber; tokensToMint > 0; i++) {
                    check = _solidified[to].contains( encodeOwnerAndId(to, i));
                    if (!check) {
                        tokensToMint--;
                        emit Transfer(address(0), to, encodeOwnerAndId(to, i));
                    }
                }
            }
        }

        emit ERC20Transfer(from, to, amount);
        return true;
    }
}
