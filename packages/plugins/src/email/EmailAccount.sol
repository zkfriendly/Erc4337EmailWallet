// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

import "account-abstraction/core/BaseAccount.sol";

contract EmailAccount is BaseAccount {
    address public owner;
    IEntryPoint private immutable _entryPoint;
    uint256 public dkimPubkeyHash;
    uint256 public accountCommitment;
    IGroth16Verifier public immutable verifier;

    constructor(IEntryPoint anEntryPoint, address anOwner, IGroth16Verifier _verifier, bytes32 _dkimPubkeyHash, bytes32 _accountCommitment) {
        _entryPoint = anEntryPoint;
        owner = anOwner;    
        verifier = _verifier;
        dkimPubkeyHash = uint256(_dkimPubkeyHash);
        accountCommitment = uint256(_accountCommitment);
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return _entryPoint;
    }

    event Log(uint256 data);
    function uintToString(uint256 _value) internal pure returns (string memory) {
        if (_value == 0) {
            return "0";
        }
        uint256 temp = _value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (_value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(_value % 10)));
            _value /= 10;
        }
        return string(buffer);
    }

    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
    internal view override returns (uint256 validationData) {
        (bytes memory proof, uint256[3] memory publicInputs) = abi.decode(userOp.signature, (bytes, uint256[3]));
        // optimizing this to return early if any of the checks fail causes gas estimation to be off by a lot in the bundler
        bool isUserOpHashValid = publicInputs[0] == uint256(userOpHash);
        bool isDkimPubkeyHashValid = publicInputs[1] == dkimPubkeyHash;
        bool isAccountCommitmentValid = publicInputs[2] == accountCommitment;
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