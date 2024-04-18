//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ST404} from "./ST404.sol";

// nuance - user can't transfer to other account and back ERC20
// tokens to generate new NFTs. User Address has solid predictable NFT list

contract RB404 is ST404 {
    // id attestation ID -> claimed count
    mapping(string => uint) internal _claimedById;

    // attestation uid -> claimed count
    mapping(bytes32 => uint) internal _claimed;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalNativeSupply,
        address _owner
    ) ST404(_name, _symbol, _decimals, _totalNativeSupply, _owner) {}

    function claim(bytes32 uid, string calldata id, address to) public {
        _claimedById[id] += 1;
        _claimed[uid] += 1;

        transferFrom(owner, to, unit);
    }

    function claimedCountById(string calldata id) public view returns (uint) {
        return _claimedById[id];
    }

    function claimedCount(bytes32 uid) public view returns (uint) {
        return _claimed[uid];
    }
}
