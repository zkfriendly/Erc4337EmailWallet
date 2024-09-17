// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

contract HMockDkimRegistry {
    function isDKIMPublicKeyHashValid(uint256 publicKeyHash) public pure returns (bool) {
        if (publicKeyHash == 5) {
            return false;
        }
        return true;
    }
}
