// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

/// @title Interface for ZKP Passwrod Groth16 verifier
interface IGroth16Verifier {
    function verifyProof(
        bytes calldata proof,
        uint256[3] memory publicSignals
    ) external view returns (bool r);
}
