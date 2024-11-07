// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

import "./EmailAccount.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

/// @title EmailAccountFactory
/// @notice A factory contract for creating EmailAccount instances
contract EmailAccountFactory {
    address public immutable entryPoint;
    address public immutable verifier;
    address public immutable dkimRegistry;
    address public immutable emailAccountImplementation;

    event EmailAccountCreated(address indexed accountAddress, uint256 accountCommitment);

    /// @notice Constructs the EmailAccountFactory contract
    /// @param _entryPoint The ERC-4337 EntryPoint contract address
    /// @param _verifier The Groth16 verifier contract address
    /// @param _dkimRegistry The DKIM registry contract address
    constructor(address _entryPoint, address _verifier, address _dkimRegistry) {
        entryPoint = _entryPoint;
        verifier = _verifier;
        dkimRegistry = _dkimRegistry;

        // Deploy the EmailAccount implementation contract
        emailAccountImplementation = address(new EmailAccount());
    }

    /// @notice Creates a new EmailAccount instance using EIP-1167 minimal proxy
    /// @param ownerEmailCommitment The hash of the owner's salted email
    /// @return The address of the newly created EmailAccount
    function createEmailAccount(uint256 ownerEmailCommitment) external returns (address) {
        address clone = Clones.cloneDeterministic(emailAccountImplementation, bytes32(ownerEmailCommitment));

        // TODO: check if we can(should) avoid passing args that can be stored in the factory and only pass the factory address to the EmailAccount
        EmailAccount(payable(clone)).initialize(
            entryPoint,
            verifier,
            dkimRegistry,
            ownerEmailCommitment,
            "example.com",
            1
        );
        emit EmailAccountCreated(clone, ownerEmailCommitment);
        return clone;
    }

    /// @notice Computes the address of a new EmailAccount instance using EIP-1167 minimal proxy
    /// @param ownerEmailCommitment The hash of the owner's salted email
    /// @return The address of the EmailAccount that would be created
    function computeAddress(uint256 ownerEmailCommitment) external view returns (address) {
        return
            Clones.predictDeterministicAddress(
                emailAccountImplementation,
                bytes32(ownerEmailCommitment),
                address(this)
            );
    }
}
