//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ST404} from "./ST404.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

// nuance - user can't transfer to other account and back ERC20
// tokens to generate new NFTs. User Address has solid predictable NFT list

contract RB404 is ST404 {
    using Strings for uint256;

    string private constant _METADATA_URI = "https://api-dev.redbrick.land/v1/nft-profiles/";

    // id attestation ID -> claimed count
    mapping(string => uint) public claimedById;

    // attestation uid -> claimed count
    mapping(bytes32 => uint) public claimedByUid;

    uint public claimed;

    uint public totalClaimable;

    uint public constant MAX_CLAIM = 5;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalNativeSupply,
        address _owner,
        address royaltyReceiver,
        uint96 feeNumerator,
        uint256 _totalClaimable
    ) ST404(_name, _symbol, _decimals, _totalNativeSupply, _owner, royaltyReceiver, feeNumerator) {
        totalClaimable = _totalClaimable;
    }

    // TODO limit claimable by owner signature or other way
    function claim(bytes32 uid, string calldata id, address to) public {
        if (1 + claimed > totalClaimable) {
            revert InvalidAmount();
        }

        if (claimedById[id] + 1 > MAX_CLAIM) {
            revert InvalidAmount();
        }

        claimedById[id] += 1;
        claimedByUid[uid] += 1;
        claimed += 1;

        _transferERC20(owner, to, unit);
    }

    // TODO limit claimable by owner signature or other way
    function bulkClaim(bytes32 uid, string calldata id, address to, uint count) public {
        if (count > MAX_CLAIM || count == 0) {
            revert InvalidAmount();
        }

        if (count + claimed > totalClaimable) {
            revert InvalidAmount();
        }

        if (claimedById[id] + count > MAX_CLAIM) {
            revert InvalidAmount();
        }

        claimedById[id] += count;
        claimedByUid[uid] += count;
        claimed += count;
        for (uint i = 0; i < count; i++) {
            _transferERC20(owner, to, unit);
        }
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
