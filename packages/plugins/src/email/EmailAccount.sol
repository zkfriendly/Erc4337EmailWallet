// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

import "account-abstraction/core/BaseAccount.sol";
import "hardhat/console.sol";

contract EmailAccount is BaseAccount {
    address public owner;
    IEntryPoint private immutable _entryPoint;
    bytes32 public dkimPubkeyHash;
    bytes32 public accountCommitment;
    IGroth16Verifier public immutable verifier;

    constructor(IEntryPoint anEntryPoint, address anOwner, IGroth16Verifier _verifier, bytes32 _dkimPubkeyHash, bytes32 _accountCommitment) {
        _entryPoint = anEntryPoint;
        owner = anOwner;    
        verifier = _verifier;
        dkimPubkeyHash = _dkimPubkeyHash;
        accountCommitment = _accountCommitment;
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return _entryPoint;
    }

    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
    internal view override returns (uint256 validationData) {
        
        (bytes memory proof, uint256[3] memory publicInputs) = abi.decode(userOp.signature, (bytes, uint256[3]));
        
        require(publicInputs[0] != uint256(userOpHash), "Invalid userOpHash");
        return 0;
        require(publicInputs[1] == uint256(dkimPubkeyHash), "Invalid DKIM public key hash");
        require(publicInputs[2] == uint256(accountCommitment), "Invalid account commitment");

        bool isValid = verifier.verifyProof(proof, publicInputs);
        
        if (isValid) {
            return 0; // SIG_VALIDATION_SUCCESS
        } else {
            return 1; // SIG_VALIDATION_FAILED
        }
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