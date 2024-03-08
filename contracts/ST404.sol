//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC404Legacy} from "./ERC404Legacy.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ERC721Events} from "./lib/ERC721Events.sol";
import {ERC20Events} from "./lib/ERC20Events.sol";

import {ERC5169} from "stl-contracts/ERC/ERC5169.sol";
import {console} from "hardhat/console.sol";

// nuance - user can't transfer to other account and back ERC20
// tokens to generate new NFTs. User Address has solid predictable NFT list

contract ST404 is ERC5169, ERC404Legacy {
    using EnumerableSet for EnumerableSet.UintSet;

    // save list of ERC721 tokens to stay them solid, block from spliting to ERC20
    // list of own Solidified tokens
    // owner -> ids[]
    mapping(address => EnumerableSet.UintSet) internal _solidified;

    uint256[] private _allTokens;
    mapping(uint256 tokenId => uint256) private _allTokensIndex;

    /// @dev TokenId packed next way: [address ¹⁶⁰] [sequentialID⁹⁶] 
    // bit 1 - bit 160 - walletAddress, which minted the token, 
    // bit 161 - 256 - sequence number of minted token in wallet

    uint256 private constant _MAX_AMOUNT = (1 << 96) - 1;

    /// @dev Addresses that are exempt from ERC-721 transfer, typically for gas savings (pairs, routers, etc)
    mapping(address => bool) internal _erc721TransferExempt;

    // To maintain compatibility with ERC721, tokens that are not stored in
    // storage still trigger the mint event when they first trasnferred into the
    // user's address. Therefore, for clarity, the following two events are
    // specifically provided when a token enters storage (_owned and _ownedData).
    event Solidified(address requestor, uint tokenId);
    event UnSolidified(address requestor, uint tokenId);
    event SetERC721TransferExempt(address target, bool state);

    error InvalidExemption();


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

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC20).interfaceId
        // ERC721 blocks Metamask to add token
        // || interfaceId == type(IERC721).interfaceId
        // || interfaceId == type(IERC721Enumerable).interfaceId
        || ERC5169.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 id_) public pure override returns (string memory) {
        return string.concat("https://to.be.changed.com/token/", Strings.toString(id_));
    }

    function _encodeOwnerAndId(address owner, uint malleableId) internal pure returns (uint id) {
        require(malleableId < _MAX_AMOUNT, "Too high mallable ID");
        assembly {
            id := or(shl(96, owner), malleableId)
        }
    }

    function _decodeOwnerAndId(uint id) internal pure returns (address owner, uint malleableId) {
        if (id < _MAX_AMOUNT) {
            revert("Invalid token ID");
        }
        malleableId = id & _MAX_AMOUNT;
        owner = address(uint160((id >> 96)));
    }

    function _getMalleableOwner(uint id_) internal view returns (address) {
        (address owner, uint id) = _decodeOwnerAndId(id_);

        if (isMalleableExists(id, owner, id_)) {
            return owner;
        } else {
            return address(0);
        }
    }

    // function _calcBalanceOf(address owner) internal view returns (uint256) {
    //     return _balanceOf[owner] + _owned[owner].length * unit;
    // }

    function balanceOf(address owner) public view returns (uint256) {
        // return _calcBalanceOf(owner);
        return _balanceOf[owner];
    }

    function erc721BalanceOf(address owner) public view returns (uint256) {
        // return _calcBalanceOf(owner);
        return _balanceOf[owner] / unit;
    }

    function isMalleableExists(uint id, address owner, uint fullId) public view returns (bool) {
        uint numberOfExistingMalleables = erc721BalanceOf(owner) - _owned[owner].length;

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
        address erc721owner = _ownerOf[id_];
        if (erc721owner != address(0)) {
            return erc721owner;
        }
        if (!_isSolidified(id_)) {
            address mallableOwner = _getMalleableOwner(id_);
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

    function _addTokenToAllTokensEnumeration(uint256 tokenId) private {
        _allTokensIndex[tokenId] = _allTokens.length;
        _allTokens.push(tokenId);
    }

    function _removeTokenFromAllTokensEnumeration(uint256 tokenId) private {
        uint256 lastTokenIndex = _allTokens.length - 1;
        uint256 tokenIndex = _allTokensIndex[tokenId];

        uint256 lastTokenId = _allTokens[lastTokenIndex];

        _allTokens[tokenIndex] = lastTokenId; // Move the last token to the slot of the to-delete token
        _allTokensIndex[lastTokenId] = tokenIndex; // Update the moved token's index

        delete _allTokensIndex[tokenId];
        _allTokens.pop();
    }

    function _setOwned(uint tokenId, address owner) internal {
        delete getApproved[tokenId];

        _addTokenToAllTokensEnumeration(tokenId);

        _ownerOf[tokenId] = owner;
        _owned[owner].push(tokenId);
        _ownedIndex[tokenId] = _owned[owner].length - 1;
    }

    function _markSolidified(uint256 id) internal {
        (address owner, ) = _decodeOwnerAndId(id);
        _solidified[owner].add(id);
        emit Solidified(owner, id);
    }

    function _transferMalleable(address from, address to, uint tokenId) internal {
        _markSolidified(tokenId);
        _setOwned(tokenId, to);
        emit ERC721Events.Transfer(from, to, tokenId);
    }

    function _doTransferERC721(address from, address to, uint tokenId) internal {
        _ownerOf[tokenId] = to;
        delete getApproved[tokenId];

        uint256 updatedId = _owned[from][_owned[from].length - 1];
        _owned[from][_ownedIndex[tokenId]] = updatedId;
        _owned[from].pop();
        _ownedIndex[updatedId] = _ownedIndex[tokenId];
        _owned[to].push(tokenId);
        _ownedIndex[tokenId] = _owned[to].length - 1;
    }

    function _doTransferERC20(address from, address to, uint amount) internal {
        require(amount <= _balanceOf[from], "Insufficient balance");
        unchecked {
            _balanceOf[from] -= amount;
            _balanceOf[to] += amount;
        }
        emit ERC20Events.Transfer(from, to, amount);
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

            _removeTokenFromAllTokensEnumeration(tokenId);
            _removeTokenFromOwnedEnumerationsAndApproved(owner, tokenId);
        }

        emit ERC721Events.Transfer(owner, address(0), tokenId);
        unchecked {
            _balanceOf[owner] -= unit;
        }
        emit ERC20Events.Transfer(owner, address(0), unit);
    }

    function _removeTokenFromOwnedEnumerationsAndApproved(address owner, uint tokenId) internal {
        uint256 lastTokenIndex = _owned[owner].length - 1;
        uint256 lastTokenId = _owned[owner][lastTokenIndex];
        uint256 tokenIndex = _ownedIndex[tokenId];
        if (tokenIndex != lastTokenIndex) {
            _ownedIndex[lastTokenId] = tokenIndex;
            _owned[owner][tokenIndex] = lastTokenId;
        }
        _owned[owner].pop();
        delete _ownedIndex[tokenId];
        delete _ownerOf[tokenId];
        delete getApproved[tokenId];
    }

    // remove token to the solidified array
    function _unSolidify(uint tokenId, address currentOwner) internal {
        (address nativeOwner, ) = _decodeOwnerAndId(tokenId);

        _solidified[nativeOwner].remove(tokenId);
        emit UnSolidified(nativeOwner, tokenId);

        _removeTokenFromOwnedEnumerationsAndApproved(currentOwner, tokenId);
        _removeTokenFromAllTokensEnumeration(tokenId);
    }

    function _doBurnFirstUserERC721(address owner) internal {
        uint256 lastTokenIndex = _owned[owner].length - 1;
        uint256 lastTokenId = _owned[owner][lastTokenIndex];
        uint256 firstTokenId = _owned[owner][0];
        if (0 != lastTokenIndex) {
            delete _ownedIndex[firstTokenId];
            _ownedIndex[lastTokenId] = 0;
            _owned[owner][0] = lastTokenId;
        }
        _owned[owner].pop();

        delete _ownerOf[firstTokenId];
        delete getApproved[firstTokenId];

        _removeTokenFromAllTokensEnumeration(firstTokenId);
    }

    function _checkAuthorized(address owner, address spender, uint256 tokenId) internal view {
        if (owner != spender && !isApprovedForAll[owner][spender] && spender != getApproved[tokenId]) {
            revert Unauthorized();
        }
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
            nativeOwner = _getMalleableOwner(tokenId);

            if (nativeOwner == address(0)) {
                revert("Token doesnt exists");
            }
            if (from != nativeOwner) {
                revert InvalidSender();
            }
            _transferMalleable(nativeOwner, to, tokenId);
            _doTransferERC20(from, to, unit);
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
                emit ERC721Events.Transfer(from, to, tokenId);
                _doTransferERC20(from, to, unit);
            }

        }
        return true;
    }

    function _maybeDecreaseERC20Allowance(address spender, uint256 amountOrId) internal {
        if (msg.sender != spender) {
            uint256 allowed = allowance[spender][msg.sender];

            if (allowed < amountOrId) {
                revert Unauthorized();
            }
            // check if its not acts like Allowance for all
            if (allowed != type(uint256).max){
                allowance[spender][msg.sender] = allowed - amountOrId;
            }
        }
    }

    function _transferERC20(address from, address to, uint amount) internal returns (bool) {
        _maybeDecreaseERC20Allowance(from, amount);
        _doTransferERC20(from, to, amount);
        uint totalFromUnits = (_balanceOf[from] + amount) / unit;
        uint malleableUnits = totalFromUnits - _owned[from].length;

        if (!whitelist[from] || !whitelist[to]) {
            uint256 tokensToBurn = totalFromUnits - _balanceOf[from] / unit;
            uint ownedTokensToBurn;
            uint256 tokensToMint;
            if (!whitelist[to] && to != address(0)){
                tokensToMint = (_balanceOf[to] / unit) - ((_balanceOf[to] - amount)/ unit);
            }
            
            // ready to mint
            uint currentSubIdToMint = (_balanceOf[to] - amount) / unit - _owned[to].length;

            if (tokensToBurn > malleableUnits) {
                ownedTokensToBurn = tokensToBurn - malleableUnits;
                tokensToBurn = malleableUnits;
            }
            
            if (!whitelist[from]) {
                // have to emit Transfer event for OpenSea and other services
                
                if (tokensToBurn > 0) {
                    // start from number of tokens + number of solidified tokens - balance
                    // -1 because first token id is 0
                    uint currentSubIdToBurn = malleableUnits + _solidified[from].length() - 1;
                    while (tokensToBurn > 0 && currentSubIdToBurn != type(uint).max){
                        currentSubIdToBurn = _burnMaximalMalleable(currentSubIdToBurn, from);
                        tokensToBurn--;
                        if (tokensToMint > 0){
                            currentSubIdToMint = _mintMinimalMalleable(currentSubIdToMint, to);
                            tokensToMint--;
                        }
                        
                    }
                }

                while (ownedTokensToBurn > 0) {
                    // update _owned for sender
                    emit ERC721Events.Transfer(from, address(0), _owned[from][0]);
                    ownedTokensToBurn--;
                    _doBurnFirstUserERC721(from);
                    if (tokensToMint > 0){
                        currentSubIdToMint = _mintMinimalMalleable(currentSubIdToMint, to);
                        tokensToMint--;
                    }
                }
            }
                
            while (tokensToMint > 0) {
                currentSubIdToMint = _mintMinimalMalleable(currentSubIdToMint, to);
                tokensToMint--;
            }
        }

        return true;
    }

    function _mintMinimalMalleable(uint startId, address to) internal returns (uint){
        uint encodedTokenId;
        do {
            encodedTokenId = _encodeOwnerAndId(to, startId);
            startId++;
            if (!_solidified[to].contains(encodedTokenId)) {
                emit ERC721Events.Transfer(address(0), to, encodedTokenId);
                return startId;
            }
            
        } while (startId < _MAX_AMOUNT);
    }

    function _burnMaximalMalleable(uint startId, address _target) internal returns (uint){
        uint encodedTokenId;
        do {
            encodedTokenId = _encodeOwnerAndId(_target, startId);
            if (!_solidified[_target].contains(encodedTokenId)) {
                emit ERC721Events.Transfer(_target, address(0), encodedTokenId);
                if (startId == 0){
                    return type(uint256).max;
                }
                return startId - 1;
            }
            startId--;
        } while (true);
    }

    /// @notice Function for token approvals
    /// @dev This function assumes id / native if amount less than or equal to current max id
    function approve(address spender, uint256 amountOrId) public virtual override returns (bool) {
        // check if its not acts like Allowance for all and not amount
        if (amountOrId > _MAX_AMOUNT && amountOrId != type(uint256).max) {
            address owner = _ownerOf[amountOrId];

            if (owner == address(0)) {
                owner = _getMalleableOwner(amountOrId);
            }
            if (owner == address(0)) {
                revert("Token to approve doesnt exists");
            }
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

    // only for owned(solodified) tokens
    function tokenByIndex(uint256 index) public view returns (uint256) {
        require( index < _allTokens.length, "Index out of bounds");
        return _allTokens[index];
    }

    // solodified+maleable tokens
    function tokenOfOwnerByIndex(address owner, uint256 index) public view returns (uint256) {
        uint owned = _owned[owner].length;
        if (owned > index) {
            return _owned[owner][index];
        }
        uint total = _balanceOf[owner] / unit;
        if (total <= index) {
            revert("Index out of bounds");
        }
        uint tokenId;
        uint skipIndex = index - owned;
        for (uint i = 0; i < total + _solidified[owner].length(); i++) {
            tokenId = _encodeOwnerAndId(owner, i);
            if (!_solidified[owner].contains(tokenId)) {
                if (skipIndex == 0) {
                    return tokenId;
                }
                skipIndex--;
            }
        }
        revert("Index out of bounds(2)");
    }

    function setSelfERC721TransferExempt(bool state_) public virtual {
        _setERC721TransferExempt(msg.sender, state_);
    }

    /// @notice Function to clear balance on exemption inclusion
    function _clearERC721Balance(address target_) private {
        uint256 erc721Balance = erc721BalanceOf(target_);

        uint toBurn = erc721Balance - _owned[target_].length;
        for (uint256 i = toBurn + _solidified[target_].length(); toBurn > 0; ) {
            // Transfer out malleable ERC721
            if (!_solidified[target_].contains(_encodeOwnerAndId(target_, i))) {
                toBurn--;
                _transferERC721(target_, address(0), _encodeOwnerAndId(target_, i));
            }
            // TODO test gas
            unchecked {
                --i;
            }
        }
        if (toBurn > 0) {
            revert("ERC721 balance exceeded");
        }
    }

    function _reinstateERC721Balance(address target_) private {
        uint256 erc721Balance = erc721BalanceOf(target_);

        uint toMint = erc721Balance - _owned[target_].length;
        for (uint256 i = 0; toMint > 0; ) {
            // Mint malleable ERC721
            if (!_solidified[target_].contains(_encodeOwnerAndId(target_, i))) {
                toMint--;
                _transferERC721( address(0), target_, _encodeOwnerAndId(target_, i));
            }
            // TODO test gas
            unchecked {
                ++i;
            }
        }
        if (toMint > 0) {
            revert("ERC721 balance exceeded");
        }
    }

    /// @notice Initialization function to set pairs / etc, saving gas by avoiding mint / burn on unnecessary targets
    function _setERC721TransferExempt(
        address target_,
        bool state_
    ) internal virtual {
        if (target_ == address(0)) {
            revert InvalidExemption();
        }

        // Adjust the ERC721 balances of the target to respect exemption rules.
        // Despite this logic, it is still recommended practice to exempt prior to the target
        // having an active balance.
        if (state_) {
        _clearERC721Balance(target_);
        } else {
        _reinstateERC721Balance(target_);
        }

        emit SetERC721TransferExempt(target_, state_);

        _erc721TransferExempt[target_] = state_;
    }
}

contract ERC404StDev is ST404 {
    using EnumerableSet for EnumerableSet.UintSet;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalNativeSupply,
        address _owner
    ) ST404(_name, _symbol, _decimals, _totalNativeSupply, _owner) {}

    function solidifiedTotal(address addr) public view returns (uint256) {
        return _solidified[addr].length();
    }

    function ownedTotal(address addr) public view returns (uint256) {
        return _owned[addr].length;
    }

    function getOwned(address addr, uint i) public view returns (uint256) {
        return _owned[addr][i];
    }

    function decodeOwnerAndId(uint id) public pure returns (address owner, uint malleableId) {
        (owner, malleableId) = _decodeOwnerAndId(id);
    }

    function encodeOwnerAndId(address owner, uint malleableId) public pure returns (uint id) {
        return _encodeOwnerAndId(owner, malleableId);
    }

    function getMalleableOwner(uint id_) public view returns (address) {
        return _getMalleableOwner(id_);
    }
}
