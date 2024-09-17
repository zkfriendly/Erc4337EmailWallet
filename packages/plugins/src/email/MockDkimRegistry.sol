// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

contract HMockDkimRegistry {
    function isDKIMPublicKeyHashValid(uint256 publicKeyHash) public pure returns (bool) {
        if (publicKeyHash == uint256(keccak256(abi.encodePacked("return false")))) {
            return false;
        }
        return true;
    }
}
