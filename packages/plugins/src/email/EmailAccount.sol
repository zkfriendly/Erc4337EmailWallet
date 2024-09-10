// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

import "account-abstraction/core/BaseAccount.sol";

contract EmailAccount is BaseAccount {
    IEntryPoint private immutable _entryPoint;
    uint256 public dkimPubkeyHash; // hash of the dkim public key of email domain
    uint256 public ownerEmailCommitment; // hash of the owner's salted email
    IGroth16Verifier public immutable verifier; // the zk verifier for email integrity and ownership

    constructor(IEntryPoint anEntryPoint, IGroth16Verifier _verifier, bytes32 _dkimPubkeyHash, bytes32 _accountCommitment) {
        _entryPoint = anEntryPoint;
        verifier = _verifier;
        dkimPubkeyHash = uint256(_dkimPubkeyHash);
        ownerEmailCommitment = uint256(_accountCommitment);
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return _entryPoint;
    }

    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
    internal view override returns (uint256 validationData) {
        (bytes memory proof, uint256[3] memory publicInputs) = abi.decode(userOp.signature, (bytes, uint256[3]));
        // optimizing this to return early if any of the checks fail causes gas estimation to be off by a lot in the bundler
        bool isUserOpHashValid = publicInputs[0] == uint256(userOpHash);
        bool isDkimPubkeyHashValid = publicInputs[1] == dkimPubkeyHash;
        bool isAccountCommitmentValid = publicInputs[2] == ownerEmailCommitment;
        bool isProofValid = verifier.verifyProof(proof, publicInputs);
        bool result = isUserOpHashValid && isDkimPubkeyHashValid && isAccountCommitmentValid && isProofValid;
        return result ? 0 : 1;
    }

    function execute(address dest, uint256 value, bytes calldata func) external {
        _requireFromEntryPoint();
        (bool success, bytes memory result) = dest.call{value: value}(func);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}
}

interface IGroth16Verifier {
    function verifyProof(bytes memory proof, uint256[3] memory publicInputs) external view returns (bool);
}