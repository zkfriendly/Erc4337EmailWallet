// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

// accesses global storage to determine if a DKIM public key hash is valid
contract HMockDkimRegistry {
    mapping(uint256 => bool) public isInvalidStorage;

    constructor() {
        isInvalidStorage[5] = true;
    }

    function isDKIMPublicKeyHashValid(
        uint256 publicKeyHash
    ) public view returns (bool) {
        if (isInvalidStorage[publicKeyHash]) {
            return false;
        }
        return true;
    }
}
