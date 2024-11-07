// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

import "@account-abstraction/contracts/core/BaseAccount.sol";
import {CommandUtils} from "@zk-email/ether-email-auth-contracts/src/libraries/CommandUtils.sol";
import {EmailAuthMsg, EmailAuth} from "@zk-email/ether-email-auth-contracts/src/EmailAuth.sol";
import "./interfaces/IGroth16Verifier.sol";
import "./interfaces/IDkimRegistry.sol";

contract SimpleEmailAuth is EmailAuth {
    function initialize() public initializer {}
    function verifyEmailProof(EmailAuthMsg memory emailAuthMsg) public view returns (bool) {
        return true;
    }
}
