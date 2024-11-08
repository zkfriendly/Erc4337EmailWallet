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

        // // Deploy the EmailAccount implementation contract
        // emailAccountImplementation = address(new EmailAccount());
    }

    /// @notice Creates a new EmailAccount instance using EIP-1167 minimal proxy
    /// @param ownerEmailCommitment The hash of the owner's salted email
    /// @return The address of the newly created EmailAccount
    function createEmailAccount(uint256 ownerEmailCommitment) external returns (address) {
        // Check that implementation is set
        require(emailAccountImplementation != address(0), "Implementation not set");

        // Create deterministic clone
        address clone = Clones.cloneDeterministic(emailAccountImplementation, bytes32(ownerEmailCommitment));

        // Verify clone address matches expected
        address expectedAddress = computeAddress(ownerEmailCommitment);
        require(clone == expectedAddress, "Invalid clone address");

        // Initialize the cloned contract
        try
            EmailAccount(payable(clone)).initialize(
                entryPoint,
                verifier,
                dkimRegistry,
                ownerEmailCommitment,
                "example.com", // Domain should probably be parameterized
                1 // Initial pubKeyHash should probably be parameterized
            )
        {
            emit EmailAccountCreated(clone, ownerEmailCommitment);
            return clone;
        } catch Error(string memory reason) {
            revert(string.concat("Initialize failed: ", reason));
        } catch {
            revert("Initialize failed with unknown error");
        }
    }

    /// @notice Computes the address of a new EmailAccount instance using EIP-1167 minimal proxy
    /// @param ownerEmailCommitment The hash of the owner's salted email
    /// @return The address of the EmailAccount that would be created
    function computeAddress(uint256 ownerEmailCommitment) public view returns (address) {
        return
            Clones.predictDeterministicAddress(
                emailAccountImplementation,
                bytes32(ownerEmailCommitment),
                address(this)
            );
    }
}
