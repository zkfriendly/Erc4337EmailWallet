// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {IGroth16Verifier} from "../interfaces/IGroth16Verifier.sol";

contract EmailGroth16Verifier is IGroth16Verifier {
    function verifyProof(
        bytes calldata proof,
        uint256[3] memory publicSignals
    ) external view returns (bool r) {
        return true;
    }
}
