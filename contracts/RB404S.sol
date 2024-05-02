//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ST404} from "./ST404.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {ERC721Events} from "./lib/ERC721Events.sol";
import {ERC20Events} from "./lib/ERC20Events.sol";

// nuance - user can't transfer to other account and back ERC20
// tokens to generate new NFTs. User Address has solid predictable NFT list

contract RB404S is ST404 {
    using Strings for uint256;
    using ECDSA for bytes32;

    string private constant _METADATA_URI = "https://api-dev.redbrick.land/v1/nft-profiles/";

    // id attestation ID -> claimed count
    mapping(string => uint) public claimedById;

    // attestation uid -> claimed count
    mapping(bytes32 => uint) public claimedByUid;

    address public trustedSigner;

    uint public claimed;

    uint public totalClaimable;

    uint public constant MAX_CLAIM = 5;

    event TrustedSignerUpdated(address prevWallet, address newWallet);
    error WrongSignature();

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalNativeSupply,
        address _owner,
        address royaltyReceiver,
        uint96 feeNumerator,
        uint256 _totalClaimable,
        address _signer
    ) ST404(_name, _symbol, _decimals, _totalNativeSupply, _owner, royaltyReceiver, feeNumerator) {
        totalClaimable = _totalClaimable;
        trustedSigner = _signer;
    }

    function setTrustedSigner(address signer) external onlyOwner {
        emit TrustedSignerUpdated(trustedSigner, signer);
        trustedSigner = signer;
    }

    function getSigner(bytes32 uid, string calldata id, address to, uint256 amount, bytes memory signature) public view returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(signature);

        return
            ecrecover(
                keccak256(
                    abi.encodePacked(
                        "\x19Ethereum Signed Message:\n32",
                        keccak256(abi.encode(uid, keccak256(abi.encodePacked(id)), address(this), block.chainid, to, amount))
                    )
                ),
                v,
                r,
                s
            );
    }

    function splitSignature(bytes memory sig) public pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "invalid signature length");

        assembly {
            /*
            First 32 bytes stores the length of the signature

            add(sig, 32) = pointer of sig + 32
            effectively, skips first 32 bytes of signature

            mload(p) loads next 32 bytes starting at the memory address p into memory
            */

            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        // implicitly return (r, s, v)
    }

    function bulkClaim(bytes32 uid, string calldata id, uint numberToMint, bytes memory signature) public {

        if (trustedSigner != getSigner(uid, id, msg.sender, numberToMint, signature)) {
            revert WrongSignature();
        }

        if (numberToMint > MAX_CLAIM || numberToMint == 0) {
            revert InvalidAmount();
        }

        if (numberToMint + claimed > totalClaimable) {
            revert InvalidAmount();
        }

        if (claimedById[id] + numberToMint > MAX_CLAIM) {
            revert InvalidAmount();
        }
        claimedById[id] += numberToMint;
        claimedByUid[uid] += numberToMint;
        claimed += numberToMint;
        _mintERC20(msg.sender, numberToMint * unit);
    }

    function _mintERC20(address to, uint amount) internal returns (bool) {

        unchecked {
            _balanceOf[to] += amount;
        }
        emit ERC20Events.Transfer(address(0), to, amount);

        uint balanceTo = _balanceOf[to];

        unchecked {

            uint256 tokensToMint = amount;
            uint currentSubIdToMint = 0;

            if (!whitelist[to]) {
                tokensToMint = (balanceTo / unit) - ((balanceTo - amount) / unit);
                currentSubIdToMint = _getMinMalleableSubId(to, (balanceTo - amount) / unit - _owned[to].length);
            }

            while (tokensToMint > 0) {
                currentSubIdToMint = _mintMinimalMalleable(currentSubIdToMint, to);
                tokensToMint--;
            }
        }

        return true;
    }

    function setTotalClaimable(uint256 _totalClaimable) public onlyOwner {
        totalClaimable = _totalClaimable;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (ownerOf(tokenId) == address(0)) {
            revert InvalidToken();
        }

        return string(abi.encodePacked(_METADATA_URI, tokenId.toString(), "?chainId=", block.chainid.toString()));
    }
}
