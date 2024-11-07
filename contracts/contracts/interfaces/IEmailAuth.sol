// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import {EmailAuthMsg} from "@zk-email/ether-email-auth-contracts/src/EmailAuth.sol";

/// @title IEmailAuth Interface
/// @notice Interface for the EmailAuth contract functionality
interface IEmailAuth {
    // --- Events ---
    event DKIMRegistryUpdated(address indexed dkimRegistry);
    event VerifierUpdated(address indexed verifier);
    event CommandTemplateInserted(uint indexed templateId);
    event CommandTemplateUpdated(uint indexed templateId);
    event CommandTemplateDeleted(uint indexed templateId);
    event EmailAuthed(bytes32 indexed emailNullifier, bytes32 indexed accountSalt, bool isCodeExist, uint templateId);
    event TimestampCheckEnabled(bool enabled);

    // --- Functions ---
    function initialize(address _initialOwner, bytes32 _accountSalt, address _controller) external;

    function dkimRegistryAddr() external view returns (address);

    function verifierAddr() external view returns (address);

    function initDKIMRegistry(address _dkimRegistryAddr) external;

    function initVerifier(address _verifierAddr) external;

    function updateDKIMRegistry(address _dkimRegistryAddr) external;

    function updateVerifier(address _verifierAddr) external;

    function getCommandTemplate(uint _templateId) external view returns (string[] memory);

    function insertCommandTemplate(uint _templateId, string[] memory _commandTemplate) external;

    function updateCommandTemplate(uint _templateId, string[] memory _commandTemplate) external;

    function deleteCommandTemplate(uint _templateId) external;

    function authEmail(EmailAuthMsg memory emailAuthMsg) external;

    function setTimestampCheckEnabled(bool _enabled) external;

    // --- View Functions ---
    function accountSalt() external view returns (bytes32);
    function controller() external view returns (address);
    function lastTimestamp() external view returns (uint);
    function timestampCheckEnabled() external view returns (bool);
    function usedNullifiers(bytes32 nullifier) external view returns (bool);
    function commandTemplates(uint templateId, uint index) external view returns (string memory);
}
