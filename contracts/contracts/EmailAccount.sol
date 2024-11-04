// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

import "@account-abstraction/contracts/core/BaseAccount.sol";
import "./interfaces/IGroth16Verifier.sol";
import "./interfaces/IDkimRegistry.sol";

/// @title EmailAccount - it is a minimal proxy that gets cloned by the factory according to EIP-1167
/// @notice A contract for managing email-based accounts with DKIM verification
/// @dev Implements BaseAccount for account abstraction
contract EmailAccount is BaseAccount {
    address private _entryPoint;
    address public dkimRegistry; // Address of the DKIM registry to query validity of DKIM public key hashes
    uint256 public ownerEmailCommitment; // Hash of the owner's salted email
    address public verifier; // The ZK verifier for email integrity and ownership

    bool public isInitialized;

    mapping(string => mapping(uint256 => bool)) public isDKIMPublicKeyHashValidCache;

    /// @dev The current pubkey hash of a userOp that was validated by _validateSignature
    /// but not yet executed. So we need to make sure the cache for this pubkey hash has been up to date when it was validated.
    uint256 public currentPubKeyHash;

    // BN128 field prime - used for reducing userOpHash to field size
    uint256 public constant p = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    /// @notice The current hash(domain, pubkeyhash) being validated
    /// @dev This is set in _validateSignatureu
    uint256 public currentHash;

    /// @notice Constructs the EmailAccount contract
    /// @param anEntryPoint The EntryPoint contract address
    /// @param _verifier The Groth16 verifier contract
    /// @param _dkimRegistry The DKIM registry contract address
    /// @param _accountCommitment The initial account commitment
    function initialize(
        address anEntryPoint,
        address _verifier,
        address _dkimRegistry,
        uint256 _accountCommitment
    ) public {
        if (isInitialized) revert();
        isInitialized = true;

        _entryPoint = anEntryPoint;
        verifier = _verifier;
        dkimRegistry = _dkimRegistry;
        ownerEmailCommitment = _accountCommitment % p;
    }

    /// @notice Returns the EntryPoint contract
    /// @return The EntryPoint contract instance
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
        (uint256[2] memory _pA, uint256[2][2] memory _pB, uint256[2] memory _pC, uint256[3] memory _pubSignals) = abi
            .decode(userOp.signature, (uint256[2], uint256[2][2], uint256[2], uint256[3]));

        currentPubKeyHash = _pubSignals[2];

        // Optimizing this to return early if any of the checks fail causes gas estimation to be off by a lot in the bundler
        bool isUserOpHashValid = _pubSignals[0] == uint256(userOpHash) % p;
        bool isAccountCommitmentValid = _pubSignals[1] == ownerEmailCommitment;
        bool isProofValid = IGroth16Verifier(verifier).verifyProof(_pA, _pB, _pC, _pubSignals);
        // we will make sure this is up to date on execution
        bool isDKIMPublicKeyHashValid = isDKIMPublicKeyHashValidCache["example.com"][currentPubKeyHash];

        bool result = isUserOpHashValid && isAccountCommitmentValid && isProofValid && isDKIMPublicKeyHashValid;

        return result ? 0 : 1;
    }

    /// @notice Executes a transaction
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
    }

    function addStake(uint32 _unstakeDelaySec) external payable {
        entryPoint().addStake{value: msg.value}(_unstakeDelaySec);
    }

    function updateDKIMPublicKeyHashCache(string memory domain, uint256 pubKeyHash) external {
        isDKIMPublicKeyHashValidCache[domain][pubKeyHash] = IDkimRegistry(dkimRegistry).isDKIMPublicKeyHashValid(
            domain,
            pubKeyHash
        );
    }

    /// @notice Receives Ether
    receive() external payable {}

    /// @notice Fallback function
    fallback() external payable {}

    /// @notice Modifier that checks if the DKIM public key hash is still valid
    /// @dev Updates the cache and only proceeds if the key is valid
    /// @dev We assume the previous value of the cache is true since this is an execution modifier
    /// @dev If invalid, returns silently to allow cache update without execution
    modifier onlyValidCache() {
        string memory domain = "example.com";
        bool isValid = IDkimRegistry(dkimRegistry).isDKIMPublicKeyHashValid(domain, currentPubKeyHash);
        isDKIMPublicKeyHashValidCache[domain][currentPubKeyHash] = isValid;

        if (!isValid) {
            return;
        }
        _;
    }
}
