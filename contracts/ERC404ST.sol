//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC404Legacy} from "./ERC404Legacy.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {ERC5169} from "stl-contracts/ERC/ERC5169.sol";
import {console} from "hardhat/console.sol";

// nuance - user can't transfer to other account and back ERC20
// tokens to generate new NFTs. User Address has solid predictable NFT list

contract ERC404ST is ERC5169, ERC404Legacy {
    using EnumerableSet for EnumerableSet.UintSet;

    // save list of ERC721 tokens to stay them solid, block from spliting to ERC20
    // list of own Solidified tokens
    // owner -> ids[]
    mapping(address => EnumerableSet.UintSet) internal _solidified;
    // list of Solidified tokens, sent to other accounts
    // owner -> ids[]
    // mapping(address => uint256[]) public ownSentSolidified;
    // list of Solidified tokens, minted for other account
    // owner -> ids[]
    // mapping(address => uint256[]) public receivedSolidified;

    /// @dev TokenId packed next way: [address ¹⁶⁰] [sequentialID⁹⁶] bit 1 - bit 160 - walletAddress, which minted the token, bit 161 - 256 - sequence number of minted token in wallet

    uint256 private constant _MAX_AMOUNT = (1 << 96) - 1;

    event Solidified(address requestor, uint tokenId);
    event UnSolidified(address requestor, uint tokenId);

    function _authorizeSetScripts(string[] memory) internal override onlyOwner {}

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalNativeSupply,
        address _owner
    ) ERC404Legacy(_name, _symbol, _decimals, _totalNativeSupply, _owner) {
        _balanceOf[_owner] = totalSupply;
        whitelist[_owner] = true;
    }

    function tokenURI(uint256 id_) public pure override returns (string memory) {
        return string.concat("https://to.be.changed.com/token/", Strings.toString(id_));
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

    // TODO remove, only for testing
    function getMallableOwner(uint id_) public view returns (address) {
        return _getMallableOwner(id_);
    }

    function _getMallableOwner(uint id_) internal view returns (address) {
        (address owner, uint id) = _decodeOwnerAndId(id_);

        if (isMalleableExists(id, owner, id_)) {
            return owner;
        } else {
            return address(0);
        }
    }

    function _calcBalanceOf(address owner) internal view returns (uint256) {
        return _balanceOf[owner] + _owned[owner].length * _getUnit();
    }

    function balanceOf(address owner) public view returns (uint256) {
        // return _calcBalanceOf(owner);
        return _balanceOf[owner];
    }

    function erc721balanceOf(address owner) public view returns (uint256) {
        // return _calcBalanceOf(owner);
        return _balanceOf[owner] / _getUnit();
    }

    function isMalleableExists(uint id, address owner, uint fullId) public view returns (bool) {
        uint numberOfExistingMalleables = erc721balanceOf(owner) - _owned[owner].length;

        // -1 because we start from 0
        if (
            numberOfExistingMalleables == 0 ||
            id > (numberOfExistingMalleables + _solidified[owner].length() - 1) ||
            address(0) != _ownerOf[fullId]
        ) {
            return false;
        }
        if (_solidified[owner].contains(fullId)) {
            return false;
        }
        return true;
    }

    function ownerOf(uint256 id_) public view override returns (address) {
        // TODO check if id_ is owned by erc721 (solified)
        address erc721owner = _ownerOf[id_];
        if (erc721owner != address(0)) {
            return erc721owner;
        }
        if (!_isSolidified(id_)) {
            address mallableOwner = _getMallableOwner(id_);
            if (mallableOwner != address(0)) {
                return mallableOwner;
            }
        }
        revert("Token not found");
    }

    function _isSolidified(uint id) internal view returns (bool) {
        (address owner, ) = _decodeOwnerAndId(id);
        return _solidified[owner].contains(id);
    }

    function _setOwned(uint tokenId, address owner) internal {
        delete getApproved[tokenId];

        _ownerOf[tokenId] = owner;
        _owned[owner].push(tokenId);
        _ownedIndex[tokenId] = _owned[owner].length - 1;
    }

    function _markSolidified(uint256 id) internal {
        (address owner, ) = _decodeOwnerAndId(id);
        _solidified[owner].add(id);
        emit Solidified(owner, id);
    }

    function _transferMallable(address from, address to, uint tokenId) internal {
        _markSolidified(tokenId);
        _setOwned(tokenId, to);
        emit Transfer(from, to, tokenId);
    }

    function _doTransferERC721(address from, address to, uint tokenId) internal {
        _ownerOf[tokenId] = to;
        delete getApproved[tokenId];
        // update _owned for sender
        uint256 updatedId = _owned[from][_owned[from].length - 1];
        _owned[from][_ownedIndex[tokenId]] = updatedId;
        // pop
        _owned[from].pop();
        // update index for the moved id
        _ownedIndex[updatedId] = _ownedIndex[tokenId];
        // push token to owned
        _owned[to].push(tokenId);
        // update index for to owned
        _ownedIndex[tokenId] = _owned[to].length - 1;
    }

    function _doTransferERC20(address from, address to, uint amount) internal {
        require(amount <= _balanceOf[from], "Not enough balance");
        unchecked {
            _balanceOf[from] -= amount;
            _balanceOf[to] += amount;
        }
        emit ERC20Transfer(from, to, amount);
    }

    function burn(uint tokenIdOrAmount) public {
        if (tokenIdOrAmount <= _MAX_AMOUNT) {
            _burnERC20(tokenIdOrAmount);
        } else {
            _burnERC721(tokenIdOrAmount);
        }
    }

    function _burnERC20(uint amount) internal virtual {
        _transferERC20(msg.sender, address(0), amount);
    }

    function _burnERC721(uint tokenId) internal virtual {
        address owner = _ownerOf[tokenId];
        if (owner == address(0)) {
            // Malleable
            (owner, ) = _decodeOwnerAndId(tokenId);
            if (owner != msg.sender) {
                revert Unauthorized();
            }
            _markSolidified(tokenId);
        } else {
            // regular ERC721
            if (owner != msg.sender) {
                revert Unauthorized();
            }
            uint256 lastId = _owned[owner][_owned[owner].length - 1];
            _owned[owner].pop();
            delete _ownedIndex[lastId];
            delete _ownerOf[lastId];
            delete getApproved[lastId];
        }

        emit Transfer(owner, address(0), tokenId);

        unchecked {
            _balanceOf[owner] -= _getUnit();
        }
        emit ERC20Transfer(owner, address(0), _getUnit());
    }

    function _checkAuthorized(address owner, address spender, uint256 tokenId) internal view {
        if (owner != spender && !isApprovedForAll[owner][spender] && spender != getApproved[tokenId]) {
            revert Unauthorized();
        }
        // console.log("Allowed ERC721");
    }

    function _detectAndHandleTransfer(address from, address to, uint256 amountOrId) internal returns (bool) {
        require(from != address(0), "Minting not allowed");
        if (amountOrId > _MAX_AMOUNT) {
            return _transferERC721(from, to, amountOrId);
        } else {
            return _transferERC20(from, to, amountOrId);
        }
    }

    /// @notice Function for mixed transfers
    function transferFrom(address from, address to, uint256 amountOrId) public virtual override {
        _detectAndHandleTransfer(from, to, amountOrId);
    }

    /// @notice Internal function for fractional transfers (erc20)
    function _transfer(address from, address to, uint256 amount) internal override returns (bool) {
        return _detectAndHandleTransfer(from, to, amount);
    }

    function _transferERC721(address from, address to, uint tokenId) internal returns (bool) {
        _checkAuthorized(from, msg.sender, tokenId);
        address ownedOwner = _ownerOf[tokenId];
        address nativeOwner;
        if (ownedOwner == address(0)) {
            nativeOwner = getMallableOwner(tokenId);

            // nativeOwner = _getMallableOwner(tokenId);
            if (nativeOwner == address(0)) {
                revert("Token doesnt exists");
            }
            if (from != nativeOwner) {
                revert InvalidSender();
            }
            _transferMallable(nativeOwner, to, tokenId);
            _doTransferERC20(from, to, _getUnit());
        } else {
            if (from != ownedOwner) {
                revert InvalidSender();
            }

            if (to == address(0)) {
                _burnERC721(tokenId);
            } else {
                (nativeOwner, ) = _decodeOwnerAndId(tokenId);
                if (nativeOwner == to) {
                    _unSolidify(tokenId, ownedOwner);
                } else {
                    _doTransferERC721(from, to, tokenId);
                }
                emit Transfer(from, to, tokenId);
                _doTransferERC20(from, to, _getUnit());
            }

            return true;
        }
    }

    // remove token to the solidified array
    function _unSolidify(uint id, address currentOwner) internal {
        (address nativeOwner, ) = _decodeOwnerAndId(id);

        _solidified[nativeOwner].remove(id);
        emit UnSolidified(nativeOwner, id);

        uint index = _ownedIndex[id];
        if (index != _owned[currentOwner].length - 1) {
            _owned[currentOwner][index] = _owned[currentOwner][_owned[currentOwner].length - 1];
        }

        _owned[currentOwner].pop();
        delete _ownedIndex[id];
        delete _ownerOf[id];
        // tokenId will be changed, so need to clear getApproved for current tokenId
        delete getApproved[id];
    }

    function _maybeDecreaseERC20Allowance(address spender, uint256 amountOrId) internal {
        if (msg.sender != spender) {
            uint256 allowed = allowance[spender][msg.sender];

            if (allowed < amountOrId) {
                revert Unauthorized();
            }

            // if (allowed != type(uint256).max)
            allowance[spender][msg.sender] = allowed - amountOrId;
        }
    }

    function _transferERC20(address from, address to, uint amount) internal returns (bool) {
        // _maybeDecreaseERC20Allowance(from, amount);
        uint256 unit = _getUnit();
        uint256 balanceBeforeSender = _balanceOf[from];
        if (balanceBeforeSender < amount) {
            revert("Insufficient balance");
        }
        uint256 balanceBeforeReceiver = _balanceOf[to];
        _maybeDecreaseERC20Allowance(from, amount);
        _doTransferERC20(from, to, amount);

        uint totalERC721OfOwner = balanceBeforeSender / unit;
        uint mallableNumber = totalERC721OfOwner - _owned[from].length;
        // Skip burn for certain addresses to save gas
        if (!whitelist[from]) {
            // have to emit Transfer event for OpenSea and other services
            uint256 tokensToBurn = (balanceBeforeSender / unit) - (_balanceOf[from] / unit);
            uint ownedTokensToBurn;
            if (tokensToBurn > mallableNumber) {
                ownedTokensToBurn = tokensToBurn - mallableNumber;
                tokensToBurn = mallableNumber;
            }

            // start from number of tokens + number of solidified tokens - balance
            if (tokensToBurn > 0) {
                for (
                    uint256 i = totalERC721OfOwner + _solidified[from].length() - _owned[from].length;
                    tokensToBurn > 0;
                    i--
                ) {
                    // i - 1 because zero token ID exists
                    if (!_solidified[from].contains(encodeOwnerAndId(from, i - 1))) {
                        tokensToBurn--;
                        emit Transfer(from, address(0), encodeOwnerAndId(from, i - 1));
                    }
                }
            }

            if (ownedTokensToBurn > 0) {
                while (ownedTokensToBurn > 0) {
                    // update _owned for sender
                    emit Transfer(from, address(0), _owned[from][0]);

                    uint256 lastId = _owned[from][_owned[from].length - 1];
                    delete _ownerOf[_owned[from][0]];
                    _owned[from][0] = lastId;
                    _owned[from].pop();
                    // update index for to owned
                    _ownedIndex[lastId] = 0;
                    ownedTokensToBurn--;
                }
            }
        }

        // Skip minting for certain addresses to save gas
        if (!whitelist[to] && to != address(0)) {
            // emit Transfer event for OpenSea and other services
            mallableNumber = balanceBeforeReceiver / unit - _owned[to].length;

            uint256 tokensToMint = (_balanceOf[to] / unit) - (balanceBeforeReceiver / unit);
            bool check;
            if (tokensToMint > 0) {
                for (uint256 i = mallableNumber; tokensToMint > 0; i++) {
                    check = _solidified[to].contains(encodeOwnerAndId(to, i));
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

    /// @notice Function for token approvals
    /// @dev This function assumes id / native if amount less than or equal to current max id
    function approve(address spender, uint256 amountOrId) public virtual override returns (bool) {
        if (amountOrId > _MAX_AMOUNT) {
            address owner = _ownerOf[amountOrId];

            if (owner == address(0)) {
                owner = _getMallableOwner(amountOrId);
            }
            if (owner == address(0)) {
                revert("Token to approve doesnt exists");
            }
            if (msg.sender != owner && !isApprovedForAll[owner][msg.sender]) {
                revert Unauthorized();
            }

            getApproved[amountOrId] = spender;

            emit Approval(owner, spender, amountOrId);
        } else {
            allowance[msg.sender][spender] = amountOrId;

            emit Approval(msg.sender, spender, amountOrId);
        }

        return true;
    }
}

contract ERC404StDev is ERC404ST {
    using EnumerableSet for EnumerableSet.UintSet;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalNativeSupply,
        address _owner
    ) ERC404ST(_name, _symbol, _decimals, _totalNativeSupply, _owner) {}

    function solidifiedTotal(address addr) public view returns (uint256) {
        return _solidified[addr].length();
    }

    function ownedTotal(address addr) public view returns (uint256) {
        return _owned[addr].length;
    }

    function getOwned(address addr, uint i) public view returns (uint256) {
        return _owned[addr][i];
    }
}
