// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

import "account-abstraction/core/BaseAccount.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract EmailAccount is BaseAccount {
    address public owner;
    IEntryPoint private immutable _entryPoint;

    constructor(IEntryPoint anEntryPoint, address anOwner) {
        _entryPoint = anEntryPoint;
        owner = anOwner;
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return _entryPoint;
    }

    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
    internal override returns (uint256 validationData) {
        return 0; // SIG_VALIDATION_SUCCESS
    }

    function execute(address dest, uint256 value, bytes calldata func) external {
        _requireFromEntryPoint();
        (bool success, bytes memory result) = dest.call{value: value}(func);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}
}