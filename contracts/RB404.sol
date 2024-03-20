//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ST404} from "./ST404.sol";

// nuance - user can't transfer to other account and back ERC20
// tokens to generate new NFTs. User Address has solid predictable NFT list

contract RB404 is ST404 {
    mapping(string => bool) internal _claimedIds;

    // attestation uid -> claimed count
    mapping(bytes32 => uint) internal _claimed;

    uint256 private _nextTokenId;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalNativeSupply,
        address _owner
    ) ST404(_name, _symbol, _decimals, _totalNativeSupply, _owner) {
        _nextTokenId = _encodeOwnerAndId(_owner, 0);
    }

    function claim(bytes32 uid, string calldata accountId, address to) public {
        require(!_claimedIds[accountId], "account id has claimed");

        _claimedIds[accountId] = true;
        _claimed[uid] += 1;
        _nextTokenId += 1;

        transferFrom(owner, to, _nextTokenId);
    }

    function isClaimed(string calldata accountId) public view returns (bool) {
        return _claimedIds[accountId];
    }

    function claimedCount(bytes32 uid) public view returns (uint) {
        return _claimed[uid];
    }
}
