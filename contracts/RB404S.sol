//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ST404} from "./ST404.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {ERC721Events} from "./lib/ERC721Events.sol";
import {ERC20Events} from "./lib/ERC20Events.sol";

contract RB404S is ST404 {
    using Strings for uint256;
    using ECDSA for bytes32;

    // string private constant _METADATA_URI = "https://api-dev.redbrick.land/v1/nft-profiles/";
    string private constant _METADATA_URI = "https://api.redbrick.land/v1/nft-profiles/";

    mapping(address => bool) public claimedByWallet;

    address public trustedSigner;

    uint public claimed;

    uint public totalClaimable;

    event TrustedSignerUpdated(address prevWallet, address newWallet);
    error WrongSignature();
    error AllClaimed();

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

    function getSigner(address to, bytes memory signature) public view returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(signature);

        return
            ecrecover(
                keccak256(
                    abi.encodePacked(
                        "\x19Ethereum Signed Message:\n32",
                        keccak256(abi.encode(address(this), block.chainid, to))
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

    function claim(bytes memory signature) public {

        if (trustedSigner != getSigner(msg.sender, signature)) {
            revert WrongSignature();
        }

        if (claimedByWallet[msg.sender]) {
            revert InvalidAmount();
        }

        if (claimed >= totalClaimable) {
            revert AllClaimed();
        }

        claimedByWallet[msg.sender] = true;
        claimed++;
        _mintERC20(msg.sender);
    }

    function _mintERC20(address to) internal returns (bool) {

        unchecked {
            _balanceOf[to] += unit;
        }
        emit ERC20Events.Transfer(address(0), to, unit);

        uint balanceTo = _balanceOf[to];

        unchecked {
            if (!whitelist[to]) {
                _mintMinimalMalleable(_getMinMalleableSubId(to, (balanceTo - unit) / unit - _owned[to].length), to);
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
