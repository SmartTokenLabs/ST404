//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC404Legacy, ERC721Receiver} from "./ERC404Legacy.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ERC721Events} from "./lib/ERC721Events.sol";
import {ERC20Events} from "./lib/ERC20Events.sol";

import {ERC5169} from "stl-contracts/ERC/ERC5169.sol";

import {CreatorTokenBase} from "@limitbreak/creator-token-contracts/contracts/utils/CreatorTokenBase.sol";
import {BasicRoyalties} from "@limitbreak/creator-token-contracts/contracts/programmable-royalties/BasicRoyalties.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";

// nuance - user can't transfer to other account and back ERC20
// tokens to generate new NFTs. User Address has solid predictable NFT list

contract ST404 is ERC5169, ERC404Legacy, CreatorTokenBase, BasicRoyalties {
    using EnumerableSet for EnumerableSet.UintSet;

    // save list of ERC721 tokens to stay them solid, block from spliting to ERC20
    // list of own Solidified tokens
    // owner -> ids[]
    mapping(address => EnumerableSet.UintSet) internal _solidified;

    uint256[] private _allTokens;
    mapping(uint256 tokenId => uint256) private _allTokensIndex;

    string public contractURI = "";

    /// @dev TokenId packed next way: [address ¹⁶⁰] [sequentialID⁹⁶]
    // bit 1 - bit 160 - walletAddress, which minted the token,
    // bit 161 - 256 - sequence number of minted token in wallet

    uint256 private constant _MAX_AMOUNT = (1 << 96) - 1;

    // To maintain compatibility with ERC721, tokens that are not stored in
    // storage still trigger the mint event when they first trasnferred into the
    // user's address. Therefore, for clarity, the following two events are
    // specifically provided when a token enters storage (_owned and _ownedData).
    event Solidified(address requestor, uint tokenId);
    event UnSolidified(address requestor, uint tokenId);

    error InvalidExemption();
    error InvalidToken();
    error InvalidAmount();
    error InsufficientBalance();
    error MintingNotSupported();
    error IndexOutOfBounds();
    error StateAlreadySet();

    function _requireCallerIsContractOwner() internal view virtual override {
        if (owner != _msgSender()) {
            revert Unauthorized();
        }
    }

    function _authorizeSetScripts(string[] memory) internal override onlyOwner {}

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalNativeSupply,
        address _owner,
        address royaltyReceiver,
        uint96 feeNumerator
    )
        ERC404Legacy(_name, _symbol, _decimals, _totalNativeSupply, _owner)
        BasicRoyalties(royaltyReceiver, feeNumerator)
    {
        _balanceOf[_owner] = totalSupply;
        whitelist[_owner] = true;
    }

    function setRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC2981, ERC5169) returns (bool) {
        return
            interfaceId == type(IERC20).interfaceId ||
            // ERC721 blocks Metamask to add token
            ERC5169.supportsInterface(interfaceId) ||
            ERC2981.supportsInterface(interfaceId);
    }

    function setContractUri(string memory _contractURI) external onlyOwner {
        _setContractUri(_contractURI);
    }

    function _setContractUri(string memory _contractURI) internal {
        contractURI = _contractURI;
    }

    function _encodeOwnerAndId(address target_, uint malleableId) internal pure returns (uint id) {
        // N1 - fix
        if (malleableId > _MAX_AMOUNT) {
            revert InvalidToken();
        }
        assembly {
            id := or(shl(96, target_), malleableId)
        }
    }

    function _decodeOwnerAndId(uint id) internal pure returns (address target_, uint malleableId) {
        // N1 - fix
        if (id <= _MAX_AMOUNT) {
            revert InvalidToken();
        }
        malleableId = id & _MAX_AMOUNT;
        target_ = address(uint160((id >> 96)));
    }

    function _getMalleableOwner(uint id_) internal view returns (address) {
        (address owner, uint id) = _decodeOwnerAndId(id_);

        if (isMalleableExists(id, owner, id_)) {
            return owner;
        } else {
            return address(0);
        }
    }

    function balanceOf(address owner) public view returns (uint256) {
        return _balanceOf[owner];
    }

    function erc721BalanceOf(address owner) public view returns (uint256) {
        unchecked {
            return _balanceOf[owner] / unit;
        }
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
        revert InvalidToken();
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
        if (amount > _balanceOf[from]) {
            revert InsufficientBalance();
        }
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
        if (from == address(0)) {
            revert MintingNotSupported();
        }

        _checkAuthorized(from, msg.sender, tokenId);

        _preValidateTransfer(msg.sender, from, to, tokenId, 0);

        // PVE003 fix
        if (to == address(0)) {
            _burnERC721(tokenId);
            return true;
        }

        address ownedOwner = _ownerOf[tokenId];
        address nativeOwner;
        if (ownedOwner == address(0)) {
            nativeOwner = _getMalleableOwner(tokenId);

            if (nativeOwner == address(0)) {
                revert InvalidToken();
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

            (nativeOwner, ) = _decodeOwnerAndId(tokenId);
            if (nativeOwner == to) {
                _unSolidify(tokenId, ownedOwner);
            } else {
                _doTransferERC721(from, to, tokenId);
            }
            emit ERC721Events.Transfer(from, to, tokenId);
            _doTransferERC20(from, to, unit);
        }
        return true;
    }

    function _maybeDecreaseERC20Allowance(address owner, uint256 amountOrId) internal {
        if (msg.sender != owner) {
            uint256 allowed = allowance[owner][msg.sender];

            if (allowed < amountOrId) {
                revert Unauthorized();
            }
            // check if its not acts like Allowance for all
            if (allowed != type(uint256).max) {
                allowance[owner][msg.sender] = allowed - amountOrId;
            }
        }
    }

    function _transferERC20(address from, address to, uint amount) internal returns (bool) {
        if (from == address(0)) {
            revert MintingNotSupported();
        }
        _maybeDecreaseERC20Allowance(from, amount);
        _doTransferERC20(from, to, amount);

        bool isFromWhitelisted = whitelist[from];
        uint balanceFrom = _balanceOf[from];
        uint balanceTo = _balanceOf[to];

        unchecked {
            uint fromMalleableUnits = (balanceFrom + amount) / unit - _owned[from].length;

            uint256 tokensToBurn = (balanceFrom + amount) / unit - balanceFrom / unit;
            uint ownedTokensToBurn = 0;
            uint256 tokensToMint = 0;
            uint currentSubIdToMint = 0;

            if (!whitelist[to] && to != address(0)) {
                tokensToMint = (balanceTo / unit) - ((balanceTo - amount) / unit);
                currentSubIdToMint = _getMinMalleableSubId(to, (balanceTo - amount) / unit - _owned[to].length);
            }

            if (tokensToBurn > fromMalleableUnits) {
                ownedTokensToBurn = tokensToBurn - fromMalleableUnits;
                tokensToBurn = fromMalleableUnits;
            }

            if (isFromWhitelisted) {
                tokensToBurn = 0;
            }

            if (tokensToBurn > 0) {
                uint currentSubIdToBurn = fromMalleableUnits + _solidified[from].length();
                while (tokensToBurn > 0) {
                    // N3 fix
                    currentSubIdToBurn = _burnMaximalMalleable(currentSubIdToBurn, from);
                    tokensToBurn--;
                    if (tokensToMint > 0) {
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
                if (tokensToMint > 0) {
                    currentSubIdToMint = _mintMinimalMalleable(currentSubIdToMint, to);
                    tokensToMint--;
                }
            }
            while (tokensToMint > 0) {
                currentSubIdToMint = _mintMinimalMalleable(currentSubIdToMint, to);
                tokensToMint--;
            }
        }

        return true;
    }

    function _getMinMalleableSubId(address _target, uint existingMalleables) internal view returns (uint emptySubId) {
        uint encodedTokenId;
        unchecked {
            while (existingMalleables > 0) {
                encodedTokenId = _encodeOwnerAndId(_target, emptySubId);
                if (!_solidified[_target].contains(encodedTokenId)) {
                    existingMalleables--;
                }
                emptySubId++;
            }
        }
        return emptySubId;
    }

    function _mintMinimalMalleable(uint startId, address to) internal returns (uint) {
        uint encodedTokenId;
        do {
            encodedTokenId = _encodeOwnerAndId(to, startId);
            unchecked {
                startId++;
            }
            if (!_solidified[to].contains(encodedTokenId)) {
                emit ERC721Events.Transfer(address(0), to, encodedTokenId);
                return startId;
            }
        } while (startId < _MAX_AMOUNT);
        return _MAX_AMOUNT;
    }

    function _burnMaximalMalleable(uint startId, address _target) internal returns (uint) {
        if (startId == 0) {
            revert InvalidToken();
        }
        uint encodedTokenId;
        do {
            unchecked {
                startId--;
            }
            encodedTokenId = _encodeOwnerAndId(_target, startId);
            if (!_solidified[_target].contains(encodedTokenId)) {
                emit ERC721Events.Transfer(_target, address(0), encodedTokenId);
                return startId;
            }
            if (startId == 0) {
                // code must not reach this point, because of calculations of external request
                revert InvalidToken();
            }
        } while (true);
        return 0;
    }

    function approve(address spender, uint256 amountOrId) external virtual override returns (bool) {
        // check if its not acts like Allowance for all and not amount
        if (amountOrId > _MAX_AMOUNT && amountOrId != type(uint256).max) {
            address owner = _ownerOf[amountOrId];

            if (owner == address(0)) {
                owner = _getMalleableOwner(amountOrId);
                if (owner == address(0)) {
                    revert InvalidToken();
                }
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

    // only for owned(solidified) tokens
    function tokenByIndex(uint256 index) public view returns (uint256) {
        if (index >= _allTokens.length) {
            revert IndexOutOfBounds();
        }
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
            revert IndexOutOfBounds();
        }
        uint tokenId;
        uint skipIndex = index - owned;
        // PVE004 fix
        uint maxIndexAllowed = total - owned + _solidified[owner].length();
        for (uint i = 0; i < maxIndexAllowed; i++) {
            tokenId = _encodeOwnerAndId(owner, i);
            if (!_solidified[owner].contains(tokenId)) {
                if (skipIndex == 0) {
                    return tokenId;
                }
                unchecked {
                    skipIndex--;
                }
            }
        }
        revert IndexOutOfBounds();
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        if (ownerOf(tokenId) == address(0)) {
            revert InvalidToken();
        }

        uint8 seed = uint8(bytes1(keccak256(abi.encodePacked(tokenId))));
        string memory imageColor;
        string memory color;

        if (seed <= 100) {
            imageColor = "blue";
            color = "Blue";
        } else if (seed <= 150) {
            imageColor = "green";
            color = "Green";
        } else if (seed <= 200) {
            imageColor = "yellow";
            color = "Yellow";
        } else if (seed <= 230) {
            imageColor = "purple";
            color = "Purple";
        } else if (seed <= 248) {
            imageColor = "red";
            color = "Red";
        } else {
            imageColor = "black";
            color = "Black";
        }

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        abi.encodePacked(
                            '{"name": "ST404 #',
                            Strings.toString(tokenId),
                            '","description":"A collection of ST404 Tokens enhanced with TokenScript',
                            '","image":"',
                            _getBubbleIconInBase64(imageColor),
                            '","attributes":[{"trait_type":"Color","value":"',
                            color,
                            '"}]}'
                        )
                    )
                )
            );
    }

    // Simple SVG icon representing the token
    function _getBubbleIcon(string memory color) private pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    "<svg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 50 50'>",
                    "<circle cx='25' cy='25' r='20' fill='",
                    color,
                    "' />",
                    "<circle cx='35' cy='15' r='5' fill='white' />",
                    "</svg>"
                )
            );
    }

    function _getBubbleIconInBase64(string memory color) private pure returns (string memory) {
        return string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(_getBubbleIcon(color)))));
    }

    function _burnAllMalleables(address target_) private {
        uint tokensToBurn = balanceOf(target_) / unit - _owned[target_].length;
        // PVE004-2
        uint currentSubIdToBurn = tokensToBurn + _solidified[target_].length();
        while (tokensToBurn > 0) {
            currentSubIdToBurn = _burnMaximalMalleable(currentSubIdToBurn, target_);
            unchecked {
                tokensToBurn--;
            }
        }
    }

    function _mintAllMalleables(address target_) private {
        unchecked {
            uint256 tokensToMint = _balanceOf[target_] / unit - _owned[target_].length;
            uint currentSubIdToMint = 0;
            while (tokensToMint > 0) {
                currentSubIdToMint = _mintMinimalMalleable(currentSubIdToMint, target_);
                tokensToMint--;
            }
        }
    }

    function setSelfERC721TransferExempt(bool state_) public virtual {
        _setERC721TransferExempt(msg.sender, state_);
    }

    /// @notice Initialization function to set pairs / etc, saving gas by avoiding mint / burn on unnecessary targets
    function _setERC721TransferExempt(address target_, bool state_) internal virtual {
        if (target_ == address(0)) {
            revert InvalidExemption();
        }
        if (whitelist[target_] == state_) {
            revert StateAlreadySet();
        }

        // Adjust the ERC721 balances of the target to respect exemption rules.
        // Despite this logic, it is still recommended practice to exempt prior to the target
        // having an active balance.
        if (state_) {
            _burnAllMalleables(target_);
        } else {
            _mintAllMalleables(target_);
        }

        emit SetERC721TransferExempt(target_, state_);
        whitelist[target_] = state_;
    }

    /// @notice Initialization function to set pairs / etc
    ///         saving gas by avoiding mint / burn on unnecessary targets
    /// method for admin only
    function setWhitelist(address target, bool state) public virtual override onlyOwner {
        // PVE002 fix
        _setERC721TransferExempt(target, state);
    }

    /// @notice Function for native transfers with contract support
    function safeTransferFrom(address from, address to, uint256 id) public virtual override {
        transferFrom(from, to, id);

        if (
            // PVE001 fix
            id > _MAX_AMOUNT &&
            to.code.length != 0 &&
            ERC721Receiver(to).onERC721Received(msg.sender, from, id, "") != ERC721Receiver.onERC721Received.selector
        ) {
            revert UnsafeRecipient();
        }
    }

    /// @notice Function for native transfers with contract support and callback data
    /// ERC721 tokens only
    function safeTransferFrom(address from, address to, uint256 id, bytes calldata data) public virtual override {
        // PVE001 fix
        if (id <= _MAX_AMOUNT) revert InvalidToken();

        _transferERC721(from, to, id);

        if (
            to.code.length != 0 &&
            ERC721Receiver(to).onERC721Received(msg.sender, from, id, data) != ERC721Receiver.onERC721Received.selector
        ) {
            revert UnsafeRecipient();
        }
    }

    /// @notice Function for fractional transfers
    // method for ERC20 only
    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        // PVE001-2
        if (amount > _MAX_AMOUNT) revert InvalidAmount();
        return _transfer(msg.sender, to, amount);
    }
}

contract ERC404StDev is ST404 {
    using EnumerableSet for EnumerableSet.UintSet;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalNativeSupply,
        address _owner,
        address royaltyReceiver,
        uint96 feeNumerator
    ) ST404(_name, _symbol, _decimals, _totalNativeSupply, _owner, royaltyReceiver, feeNumerator) {}

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
