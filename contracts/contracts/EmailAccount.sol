// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

import "@account-abstraction/contracts/core/BaseAccount.sol";
import "./interfaces/IGroth16Verifier.sol";
import "./interfaces/IDkimRegistry.sol";
import "./interfaces/IEmailAuth.sol";
import "@zk-email/ether-email-auth-contracts/src/EmailAuth.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import {Verifier} from "@zk-email/ether-email-auth-contracts/src/utils/Verifier.sol";
import {IDKIMRegistry} from "@zk-email/contracts/DKIMRegistry.sol";

/// @title EmailAccount - Email-based account abstraction with DKIM verification
/// @dev Implements EIP-1167 minimal proxy pattern and EIP-4337 BaseAccount
/// @notice This contract enables email-based account abstraction by verifying DKIM signatures
contract EmailAccount is BaseAccount, IDkimRegistry, EmailAuth {
    // Constants
    /// @dev Prefix used for generating template IDs
    string private constant TEMPLATE_PREFIX = "EMAIL_ACCOUNT_0";
    /// @dev Domain associated with this account
    string private DOMAIN;

    // State Variables
    /// @dev Address of the EntryPoint contract
    address private _entryPoint;
    /// @dev Address of the global DKIM registry
    address public globalDKIMRegistry;
    /// @dev Mapping of domain => pubKeyHash => validity
    mapping(string => mapping(uint256 => bool)) public isDKIMPublicKeyHashValidCache;
    /// @dev Current public key hash being used
    uint256 public currentPubKeyHash;

    // Events
    /// @notice Emitted when DKIM cache is updated for a domain
    /// @param domain The email domain
    /// @param pubKeyHash The public key hash
    /// @param isValid Whether the public key hash is valid
    event DKIMCacheUpdated(string domain, uint256 pubKeyHash, bool isValid);

    /// @notice Emitted when a transaction is executed
    /// @param dest The destination address
    /// @param value The amount of ETH sent
    /// @param data The calldata
    event TransactionExecuted(address indexed dest, uint256 value, bytes data);

    // Modifiers
    /// @notice Ensures DKIM public key hash is valid before execution
    modifier onlyValidCache() {
        bool isValid = IDkimRegistry(globalDKIMRegistry).isDKIMPublicKeyHashValid(DOMAIN, currentPubKeyHash);
        isDKIMPublicKeyHashValidCache[DOMAIN][currentPubKeyHash] = isValid;
        if (!isValid) {
            return;
        }
        _;
    }

    // External/Public Functions
    /// @notice Initializes account with core parameters
    /// @param __entryPoint The EntryPoint contract address
    /// @param _verifier The verifier contract address
    /// @param _dkimRegistry The DKIM registry contract address
    /// @param _accountSalt The salt for this account
    /// @param _domain The email domain
    /// @param _pubKeyHash The initial public key hash
    function initialize(
        address __entryPoint,
        address _verifier,
        address _dkimRegistry,
        uint256 _accountSalt,
        string memory _domain,
        uint256 _pubKeyHash
    ) public initializer {
        _validateInitParams(__entryPoint, _verifier, _dkimRegistry);
        _setupCore(__entryPoint, _dkimRegistry, _domain);
        _initializeBase(_accountSalt, _verifier);
        updateDKIMPublicKeyHashCache(_domain, _pubKeyHash);
    }

    /// @notice Returns the EntryPoint contract
    /// @return The EntryPoint contract interface
    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(_entryPoint);
    }

    /// @notice Executes validated transaction
    /// @param dest The destination address
    /// @param value The amount of ETH to send
    /// @param func The calldata to execute
    function execute(address dest, uint256 value, bytes calldata func) external onlyValidCache {
        _requireFromEntryPoint();
        _executeTransaction(dest, value, func);
    }

    /// @notice Adds stake to the EntryPoint contract
    /// @param _unstakeDelaySec Delay before stake can be withdrawn
    function addStake(uint32 _unstakeDelaySec) external payable {
        entryPoint().addStake{value: msg.value}(_unstakeDelaySec);
    }

    /// @notice Updates DKIM public key hash cache
    /// @param domain The email domain
    /// @param pubKeyHash The public key hash to cache
    function updateDKIMPublicKeyHashCache(string memory domain, uint256 pubKeyHash) public {
        bool isValid = IDkimRegistry(globalDKIMRegistry).isDKIMPublicKeyHashValid(domain, pubKeyHash);
        isDKIMPublicKeyHashValidCache[domain][pubKeyHash] = isValid;
        emit DKIMCacheUpdated(domain, pubKeyHash, isValid);
    }

    /// @notice Checks if a DKIM public key hash is valid for a domain
    /// @param domainName The email domain to check
    /// @param publicKeyHash The public key hash to validate
    /// @return True if the public key hash is valid
    function isDKIMPublicKeyHashValid(string memory domainName, uint256 publicKeyHash) public view returns (bool) {
        return isDKIMPublicKeyHashValidCache[domainName][publicKeyHash];
    }

    /// @notice Computes template ID for a given index
    /// @param templateIdx The template index
    /// @return The computed template ID
    function computeTemplateId(uint256 templateIdx) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(TEMPLATE_PREFIX, templateIdx)));
    }

    // Internal Functions
    /// @notice Validates user operation signature using email authentication
    /// @param userOp The user operation to validate
    /// @param userOpHash The hash of the user operation
    /// @return validationData 0 if valid, 1 if invalid
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256 validationData) {
        EmailAuthMsg memory emailAuthMsg = abi.decode(userOp.signature, (EmailAuthMsg));
        authEmail(emailAuthMsg);
        uint256 signedHash = abi.decode(emailAuthMsg.commandParams[0], (uint256));
        return userOpHash == bytes32(signedHash) ? 0 : 1;
    }

    /// @notice Initializes command templates
    function initCommands() internal {
        string[][] memory templates = _createTemplates();
        _insertTemplates(templates);
    }

    // Private Functions
    /// @notice Validates initialization parameters
    /// @param anEntryPoint The EntryPoint address
    /// @param _verifier The verifier address
    /// @param _dkimRegistry The DKIM registry address
    function _validateInitParams(address anEntryPoint, address _verifier, address _dkimRegistry) private pure {
        require(anEntryPoint != address(0), "Invalid EntryPoint address");
        require(_verifier != address(0), "Invalid verifier address");
        require(_dkimRegistry != address(0), "Invalid DKIM registry address");
    }

    /// @notice Sets up core contract parameters
    /// @param __entryPoint The EntryPoint address
    /// @param _dkimRegistry The DKIM registry address
    /// @param _domain The email domain
    function _setupCore(address __entryPoint, address _dkimRegistry, string memory _domain) private {
        _entryPoint = __entryPoint;
        globalDKIMRegistry = _dkimRegistry;
        DOMAIN = _domain;
    }

    /// @notice Initializes base contract parameters
    /// @param _accountSalt The account salt
    /// @param _verifier The verifier address
    function _initializeBase(uint256 _accountSalt, address _verifier) private {
        __Ownable_init(address(this));
        controller = address(this);
        accountSalt = bytes32(_accountSalt);
        dkim = IDKIMRegistry(address(this));
        verifier = Verifier(_verifier);
        initCommands();
    }

    /// @notice Executes a transaction
    /// @param dest The destination address
    /// @param value The amount of ETH to send
    /// @param func The calldata to execute
    function _executeTransaction(address dest, uint256 value, bytes calldata func) private {
        (bool success, bytes memory result) = dest.call{value: value}(func);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        emit TransactionExecuted(dest, value, func);
    }

    /// @notice Creates command templates
    /// @return Array of command templates
    function _createTemplates() private pure returns (string[][] memory) {
        string[][] memory templates = new string[][](1);
        templates[0] = new string[](2);
        templates[0][0] = "SignHash";
        templates[0][1] = "{uint}";
        return templates;
    }

    /// @notice Inserts command templates
    /// @param templates Array of templates to insert
    function _insertTemplates(string[][] memory templates) private {
        for (uint8 i = 0; i < templates.length; i++) {
            commandTemplates[computeTemplateId(i)] = templates[i];
        }
    }

    // Receive/Fallback Functions
    /// @notice Allows contract to receive ETH
    receive() external payable {}
    /// @notice Fallback function
    fallback() external payable {}
}
