// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

import "@account-abstraction/contracts/core/BaseAccount.sol";
import "./interfaces/IGroth16Verifier.sol";
import "./interfaces/IDkimRegistry.sol";

contract EmailAccount is BaseAccount {
    address private _entryPoint;
    address public dkimRegistry;
    uint256 public ownerEmailCommitment;
    address public verifier;

    bool public isInitialized;

    uint256 public constant p =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    uint256 public currentHash;

    error DKIMHashInvalid();

    function initialize(
        address anEntryPoint,
        address _verifier,
        address _dkimRegistry,
        uint256 _accountCommitment
    ) public {
        if(isInitialized) revert();
        isInitialized = true;

        _entryPoint = anEntryPoint;
        verifier = _verifier;
        dkimRegistry = _dkimRegistry;
        ownerEmailCommitment = _accountCommitment % p;
        
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(_entryPoint);
    }

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view override returns (uint256 validationData) {
        (
            uint256[2] memory _pA,
            uint256[2][2] memory _pB,
            uint256[2] memory _pC,
            uint256[3] memory _pubSignals
        ) = abi.decode(
                userOp.signature,
                (uint256[2], uint256[2][2], uint256[2], uint256[3])
            );

        bool isUserOpHashValid = _pubSignals[0] == uint256(userOpHash) % p;
        bool isAccountCommitmentValid = _pubSignals[1] == ownerEmailCommitment;
        bool isProofValid = IGroth16Verifier(verifier).verifyProof(
            _pA,
            _pB,
            _pC,
            _pubSignals
        );
        bool result = isUserOpHashValid &&
            isAccountCommitmentValid &&
            isProofValid &&
            IDkimRegistry(dkimRegistry).isDKIMPublicKeyHashValid(_pubSignals[2]);

        return result ? 0 : 1;
    }

    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external {
        _requireFromEntryPoint();
        (bool success, bytes memory result) = dest.call{value: value}(func);

        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function addStake(uint32 _unstakeDelaySec) external payable {
        entryPoint().addStake{value: msg.value}(_unstakeDelaySec);
    }

    receive() external payable {}

    fallback() external payable {}
}
