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
contract EmailAccount is BaseAccount, IDkimRegistry, EmailAuth {
    // Events
    event DKIMCacheUpdated(string domain, uint256 pubKeyHash, bool isValid);
    event TransactionExecuted(address indexed dest, uint256 value, bytes data);

    // Constants
    string private constant TEMPLATE_PREFIX = "EMAIL_ACCOUNT_0";
    string private DOMAIN;

    // State Variables
    address private _entryPoint;
    address public globalDKIMRegistry;
    mapping(string => mapping(uint256 => bool)) public isDKIMPublicKeyHashValidCache;
    uint256 public currentPubKeyHash;

    modifier onlyValidCache() {
        bool isValid = IDkimRegistry(globalDKIMRegistry).isDKIMPublicKeyHashValid(DOMAIN, currentPubKeyHash);
        isDKIMPublicKeyHashValidCache[DOMAIN][currentPubKeyHash] = isValid;
        if (!isValid) {
            return;
        }
        _;
    }

    /// @notice Initializes account with core parameters
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

    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(_entryPoint);
    }

    /// @notice Validates user operation signature
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256 validationData) {
        // extract the proof from signature
        EmailAuthMsg memory emailAuthMsg = abi.decode(userOp.signature, (EmailAuthMsg));
        // reverts if the proof is invalid
        authEmail(emailAuthMsg);
        uint256 signedHash = abi.decode(emailAuthMsg.commandParams[0], (uint256));

        return userOpHash == bytes32(signedHash) ? 0 : 1;
    }

    /// @notice Executes validated transaction
    function execute(address dest, uint256 value, bytes calldata func) external onlyValidCache {
        _requireFromEntryPoint();
        _executeTransaction(dest, value, func);
    }

    function addStake(uint32 _unstakeDelaySec) external payable {
        entryPoint().addStake{value: msg.value}(_unstakeDelaySec);
    }

    /// @notice Updates DKIM public key hash cache
    function updateDKIMPublicKeyHashCache(string memory domain, uint256 pubKeyHash) public {
        bool isValid = IDkimRegistry(globalDKIMRegistry).isDKIMPublicKeyHashValid(domain, pubKeyHash);
        isDKIMPublicKeyHashValidCache[domain][pubKeyHash] = isValid;
        emit DKIMCacheUpdated(domain, pubKeyHash, isValid);
    }

    function isDKIMPublicKeyHashValid(string memory domainName, uint256 publicKeyHash) public view returns (bool) {
        return isDKIMPublicKeyHashValidCache[domainName][publicKeyHash];
    }

    function computeTemplateId(uint256 templateIdx) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(TEMPLATE_PREFIX, templateIdx)));
    }

    /// @notice Initializes command templates
    function initCommands() internal {
        string[][] memory templates = _createTemplates();
        _insertTemplates(templates);
    }

    // Internal functions
    function _validateInitParams(address anEntryPoint, address _verifier, address _dkimRegistry) private pure {
        require(anEntryPoint != address(0), "Invalid EntryPoint address");
        require(_verifier != address(0), "Invalid verifier address");
        require(_dkimRegistry != address(0), "Invalid DKIM registry address");
    }

    function _setupCore(address __entryPoint, address _dkimRegistry, string memory _domain) private {
        _entryPoint = __entryPoint;
        globalDKIMRegistry = _dkimRegistry;
        DOMAIN = _domain;
    }

    function _initializeBase(uint256 _accountSalt, address _verifier) private {
        initialize(address(this), bytes32(_accountSalt), address(this));
        initDKIMRegistry(address(this));
        initVerifier(_verifier);
        initCommands();
    }

    function _executeTransaction(address dest, uint256 value, bytes calldata func) private {
        (bool success, bytes memory result) = dest.call{value: value}(func);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        emit TransactionExecuted(dest, value, func);
    }

    function _createTemplates() private pure returns (string[][] memory) {
        string[][] memory templates = new string[][](1);
        templates[0] = new string[](2);
        templates[0][0] = "SignHash";
        templates[0][1] = "{uint}";
        return templates;
    }

    function _insertTemplates(string[][] memory templates) private {
        for (uint8 i = 0; i < templates.length; i++) {
            insertCommandTemplate(computeTemplateId(i), templates[i]);
        }
    }

    receive() external payable {}
    fallback() external payable {}
}
