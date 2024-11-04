// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IDkimRegistry {
    function isDKIMPublicKeyHashValid(string memory domainName, uint256 publicKeyHash) external view returns (bool);
}