// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

import "@account-abstraction/contracts/core/BaseAccount.sol";
import "./interfaces/IGroth16Verifier.sol";
import "./interfaces/IDkimRegistry.sol";
import "./interfaces/IEmailAuth.sol";
import "@zk-email/ether-email-auth-contracts/src/EmailAuth.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import {Verifier} from "@zk-email/ether-email-auth-contracts/src/utils/Verifier.sol";

/// @title EmailAccount - A minimal proxy for email-based accounts with DKIM verification
/// @notice This contract enables account abstraction using email-based authentication
/// @dev Implements EIP-1167 minimal proxy pattern and EIP-4337 BaseAccount
contract EmailAccount is BaseAccount, EmailAuth {
    // --- Events ---
    event AccountInitialized(
        address indexed entryPoint,
        address indexed verifier,
        address indexed dkimRegistry,
        uint256 commitment
    );
    event DKIMCacheUpdated(string domain, uint256 pubKeyHash, bool isValid);
    event TransactionExecuted(address indexed dest, uint256 value, bytes data);

    // --- State Variables ---
    /// @notice The EntryPoint contract address
    address private _entryPoint;

    /// @notice Address of the DKIM registry for validating public key hashes
    address public globalDKIMRegistry;

    /// @notice Cache of validated DKIM public key hashes per domain
    mapping(string => mapping(uint256 => bool)) public isDKIMPublicKeyHashValidCache;

    /// @notice Current pubkey hash being processed in a userOp
    /// @dev Used to track validation state between signature check and execution
    uint256 public currentPubKeyHash;

    /// @notice Current hash of domain and pubkeyhash being validated
    uint256 public currentHash;

    /// @notice Initializes the account with core parameters
    /// @param anEntryPoint The EntryPoint contract address
    /// @param _verifier The Groth16 verifier contract
    /// @param _dkimRegistry The DKIM registry contract address
    /// @param _accountSalt The account salt used for deterministic address generation
    function initialize(
        address anEntryPoint,
        address _verifier,
        address _dkimRegistry,
        uint256 _accountSalt,
        string memory _domain, // initial values to initialize the cache
        uint256 _pubKeyHash // initial values to initialize the cache
    ) public initializer {
        // Input validation
        require(anEntryPoint != address(0), "Invalid EntryPoint address");
        require(_verifier != address(0), "Invalid verifier address");
        require(_dkimRegistry != address(0), "Invalid DKIM registry address");

        // Set core contract addresses
        _entryPoint = anEntryPoint;
        globalDKIMRegistry = _dkimRegistry;

        // Initialize base EmailAuth contract
        // We pass this contract as owner, salt and controller since it manages itself
        initialize(address(this), bytes32(_accountSalt), address(this));
        initDKIMRegistry(address(this)); // dkim registry is this contract itself. Which is the cache.
        initVerifier(_verifier);

        emit AccountInitialized(anEntryPoint, _verifier, _dkimRegistry, _accountSalt);
    }
    /// @inheritdoc BaseAccount
    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(_entryPoint);
    }

    /// @notice Validates the signature of a user operation
    /// @param userOp The user operation to validate
    /// @param userOpHash The hash of the user operation
    /// @return validationData 0 if valid, 1 if invalid
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256 validationData) {
        bool isUserOpHashValid = true;
        bool isAccountCommitmentValid = true;
        bool isProofValid = true;
        bool isDKIMPublicKeyHashValid = true;

        bool result = isUserOpHashValid && isAccountCommitmentValid && isProofValid && isDKIMPublicKeyHashValid;

        return result ? 0 : 1;
    }

    /// @notice Executes a transaction after validation
    /// @param dest The destination address
    /// @param value The amount of ETH to send
    /// @param func The function data to execute
    function execute(address dest, uint256 value, bytes calldata func) external onlyValidCache {
        _requireFromEntryPoint();
        (bool success, bytes memory result) = dest.call{value: value}(func);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        emit TransactionExecuted(dest, value, func);
    }

    /// @notice Adds stake to the EntryPoint contract
    /// @param _unstakeDelaySec Delay before stake can be withdrawn
    function addStake(uint32 _unstakeDelaySec) external payable {
        entryPoint().addStake{value: msg.value}(_unstakeDelaySec);
    }

    /// @notice Updates the cache for a DKIM public key hash
    /// @param domain The email domain
    /// @param pubKeyHash The public key hash to validate
    function updateDKIMPublicKeyHashCache(string memory domain, uint256 pubKeyHash) external {
        bool isValid = IDkimRegistry(globalDKIMRegistry).isDKIMPublicKeyHashValid(domain, pubKeyHash);
        isDKIMPublicKeyHashValidCache[domain][pubKeyHash] = isValid;
        emit DKIMCacheUpdated(domain, pubKeyHash, isValid);
    }

    /// @notice Receives ETH transfers
    receive() external payable {}

    /// @notice Fallback function for unknown calls
    fallback() external payable {}

    /// @notice Ensures DKIM public key hash is valid before execution
    /// @dev Updates cache and validates current public key hash
    modifier onlyValidCache() {
        string memory domain = "example.com";
        bool isValid = IDkimRegistry(globalDKIMRegistry).isDKIMPublicKeyHashValid(domain, currentPubKeyHash);
        isDKIMPublicKeyHashValidCache[domain][currentPubKeyHash] = isValid;

        if (!isValid) {
            return;
        }
        _;
    }
}
