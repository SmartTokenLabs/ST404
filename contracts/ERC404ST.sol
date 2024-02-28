//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC404Legacy} from "./ERC404Legacy.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC5169} from "stl-contracts/ERC/ERC5169.sol";

// nuance - user can't transfer to other account and back ERC20
// tokens to generate new NFTs. User Address has solid predictable NFT list

contract ERC404ST is ERC5169, ERC404Legacy {
    // save list of ERC721 tokens to stay them solid, block from spliting to ERC20
    // list of own Solidified tokens
    // owner -> ids[]
    mapping(address => uint256[]) public solidified;
    // list of Solidified tokens, sent to other accounts
    // owner -> ids[]
    mapping(address => uint256[]) public ownSentSolidified;
    // list of Solidified tokens, minted for other account
    // owner -> ids[]
    mapping(address => uint256[]) public receivedSolidified;

    /// @dev TokenId packed next way: bit 0 == 1 when its a tokenID, bit 1 - bit 160 - walletAddress, which minted the token, bit 161 - 255 - sequence number of mallable token in wallet

    /// @dev Address bitmask for packed ownership data
    uint256 private constant _BITMASK_ADDRESS = (1 << 160) - 1;

    /// @dev Owned index bitmask for packed ownership data
    uint256 private constant _BITMASK_OWNED_INDEX = ((1 << 96) - 1) << 160;

    /// HIGHEST bit to mark tokenId vs amount
    uint256 private constant _ID_BIT = 1 << 255;

    // TODO test it
    uint256 private constant _MAX_MALLABLE_ID = 1 << (96 - 1);

    function _authorizeSetScripts(string[] memory) internal override onlyOwner {}

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalNativeSupply,
        address _owner
    ) ERC404Legacy(_name, _symbol, _decimals, _totalNativeSupply, _owner) {}

    function tokenURI(uint256 id_) public pure override returns (string memory) {
        return string.concat("https://to.be.changed.com/token/", Strings.toString(id_));
    }

    // add token to the solidified array
    function solidify(uint id) public {
        // msg.sender must be an owner or approved
        if (_ownerOf[id] != address(0)) {
            revert("Already solidified");
        }
        address owner = _getMallableOwner(id);
        if (owner == address(0)) {
            revert("Token doesnt exists");
        }
        solidified[owner][id] = 1;

        _ownerOf[id] = msg.sender;

        // push token to owned
        _owned[msg.sender].push(id);
        // update index for to owned
        _ownedIndex[id] = _owned[msg.sender].length - 1;
    }

    // remove token to the solidified array
    function unSolidify(uint id) public {
        // msg.sender must be an owner or approved

        address currentOwner = _ownerOf[id];
        if (currentOwner == address(0)) {
            revert("Not solidified");
        }

        solidified[msg.sender][id] = 0;

        uint index = _ownedIndex[id];
        if (index != _owned[msg.sender].length - 1) {
            _owned[msg.sender][index] = _owned[msg.sender][_owned[msg.sender].length - 1];
        }
        _owned[msg.sender].pop();
        delete _ownedIndex[id];
        delete _ownerOf[id];

        (address owner, uint id) = _decodeOwnerAndId(id);
        if (owner != currentOwner) {
            // tokenId will be changed, so need to clear getApproved for current tokenId
            delete getApproved[id];
        }
    }

    function erc20BalanceOf(address owner_) public view virtual returns (uint256) {
        return balanceOf[owner_];
    }

    function _encodeOwnerAndId(address owner, uint mallableId) internal pure returns (uint id) {
        require(mallableId < _MAX_MALLABLE_ID, "Too high mallable ID");
        id = ((uint256(uint160(owner)) & _BITMASK_ADDRESS) << 95) | _ID_BIT | mallableId;
    }

    function _decodeOwnerAndId(uint id) internal pure returns (address owner, uint mallableId) {
        if (id < _ID_BIT) {
            revert("Invalid token ID");
        }
        mallableId = id & _MAX_MALLABLE_ID;
        owner = address(uint160((id >> 95) & _BITMASK_ADDRESS));
    }

    function _getMallableOwner(uint id_) internal view returns (address) {
        // get owner by tokenID
        (address owner, uint id) = _decodeOwnerAndId(id_);

        uint mallableNumber = erc20BalanceOf(owner) / _getUnit() - _owned[owner].length;

        if (mallableNumber == 0) {
            return address(0);
        }

        uint mallableCounter = 0;
        // we have "id" and owner
        for (uint i = 0; i <= id; ++i) {
            if (solidified[owner][i] == 0) {
                mallableCounter++;
            }
        }
        if (mallableCounter > mallableNumber) {
            return address(0);
        }

        return owner;
    }

    function ownerOf(uint256 id_) public view override returns (address) {
        // check if id_ is owned by erc721 (solified)
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
        if (amountOrId < _ID_BIT) {
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
            uint256 allowed = allowance[from][msg.sender];

            if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amountOrId;

            _transfer(from, to, amountOrId);
        }
    }

    /// @notice Internal function for fractional transfers (erc20)
    function _transfer(address from, address to, uint256 amount) internal override returns (bool) {
        require(amount < _ID_BIT, "Its ID, not amount");
        uint256 unit = _getUnit();
        uint256 balanceBeforeSender = balanceOf[from];
        uint256 balanceBeforeReceiver = balanceOf[to];

        balanceOf[from] -= amount;

        unchecked {
            balanceOf[to] += amount;
        }

        uint totalERC721OfOwner = erc20BalanceOf(from) / _getUnit();
        uint mallableNumber = totalERC721OfOwner - _owned[from].length;

        // Skip burn for certain addresses to save gas
        if (!whitelist[from]) {
            // have to emit Transfer event for OpenSea and other services
            uint256 tokensToBurn = (balanceBeforeSender / unit) - (balanceOf[from] / unit);
            if (tokensToBurn > mallableNumber) {
                revert("unsolidify tokens before transfer erc20");
            }
            for (uint256 i = totalERC721OfOwner; tokensToBurn == 0; i--) {
                if (solidified[from][i] == 0) {
                    tokensToBurn--;
                    emit Transfer(from, address(0), i);
                }
            }
        }

        // Skip minting for certain addresses to save gas
        if (!whitelist[to]) {
            // have to emit Transfer event for OpenSea and other services

            totalERC721OfOwner = erc20BalanceOf(to) / _getUnit();
            mallableNumber = totalERC721OfOwner - _owned[to].length;

            uint256 tokensToMint = (balanceOf[to] / unit) - (balanceBeforeReceiver / unit);
            for (uint256 i = 0; i < tokensToMint; i++) {
                _mint(to);
            }
            for (uint256 i = mallableNumber + 1; tokensToMint == 0; i++) {
                if (solidified[from][i] == 0) {
                    tokensToMint--;
                    emit Transfer(address(0), to, i);
                }
            }
        }

        emit ERC20Transfer(from, to, amount);
        return true;
    }
}
