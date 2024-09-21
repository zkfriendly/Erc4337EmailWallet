// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

// accesses global storage to determine if a DKIM public key hash is valid
contract HMockDkimRegistry {
    uint256 public isInvalidStorage;

    constructor() {
        isInvalidStorage = 5;
    }

    function isDKIMPublicKeyHashValid(
        uint256 publicKeyHash
    ) public view returns (bool) {
        if (publicKeyHash == isInvalidStorage) {
            return false;
        }
        return true;
    }
}
