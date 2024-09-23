// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

import "./EmailAccount.sol";

/// @title EmailAccountFactory
/// @notice A factory contract for creating EmailAccount instances
contract EmailAccountFactory {
    address public immutable entryPoint;
    address public immutable verifier;
    address public immutable dkimRegistry;

    event EmailAccountCreated(address indexed accountAddress, uint256 accountCommitment);

    /// @notice Constructs the EmailAccountFactory contract
    /// @param _entryPoint The ERC-4337 EntryPoint contract address
    /// @param _verifier The Groth16 verifier contract address
    /// @param _dkimRegistry The DKIM registry contract address
    constructor(address _entryPoint, address _verifier, address _dkimRegistry) {
        entryPoint = _entryPoint;
        verifier = _verifier;
        dkimRegistry = _dkimRegistry;
    }

    /// @notice Creates a new EmailAccount instance using create2 for deterministic address
    /// @param ownerEmailCommitment The hash of the owner's salted email
    /// @return The address of the newly created EmailAccount
    function createEmailAccount(uint256 ownerEmailCommitment) external returns (address) {
        address newAccount = _computeAddress(ownerEmailCommitment);
        bytes memory bytecode = _getBytecode(ownerEmailCommitment);
        assembly {
            newAccount := create2(0, add(bytecode, 0x20), mload(bytecode), ownerEmailCommitment)
            if iszero(newAccount) {
                revert(0, 0)
            }
        }
        emit EmailAccountCreated(newAccount, ownerEmailCommitment);
        return newAccount;
    }

    /// @notice Computes the address of a new EmailAccount instance using create2
    /// @param ownerEmailCommitment The hash of the owner's salted email
    /// @return The address of the EmailAccount that would be created
    function computeAddress(uint256 ownerEmailCommitment) external view returns (address) {
        return _computeAddress(ownerEmailCommitment);
    }

    /// @notice Internal function to get the bytecode for the EmailAccount contract
    /// @param ownerEmailCommitment The hash of the owner's salted email
    /// @return The bytecode of the EmailAccount contract
    function _getBytecode(uint256 ownerEmailCommitment) internal view returns (bytes memory) {
        return abi.encodePacked(
            type(EmailAccount).creationCode,
            abi.encode(entryPoint, verifier, dkimRegistry, ownerEmailCommitment)
        );
    }

    /// @notice Internal function to compute the address of a new EmailAccount instance using create2
    /// @param ownerEmailCommitment The hash of the owner's salted email
    /// @return The address of the EmailAccount that would be created
    function _computeAddress(uint256 ownerEmailCommitment) internal view returns (address) {
        bytes32 salt = bytes32(ownerEmailCommitment);
        bytes memory bytecode = _getBytecode(ownerEmailCommitment);
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );
        return address(uint160(uint256(hash)));
    }
}