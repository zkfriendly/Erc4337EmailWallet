// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;
 
import { ERC7579ValidatorBase } from "@rhinestone/module-bases/src/ERC7579ValidatorMaster.sol";
import { PackedUserOperation } from "@rhinestone/module-bases/src/external/ERC4337.sol";
 
import { SignatureCheckerLib } from "solady/src/utils/SignatureCheckerLib.sol";
import { ECDSA } from "solady/src/utils/ECDSA.sol";
 
contract MultiOwnerValidator is ERC7579ValidatorBase {}