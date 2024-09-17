// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

import "account-abstraction/core/BaseAccount.sol";
import "./interfaces/IGroth16Verifier.sol";
import "./interfaces/IDkimRegistry.sol";

contract EmailAccount is BaseAccount {
    IEntryPoint private immutable _entryPoint;
    address public dkimRegistry; // address of the dkim registry to query validity of dkim public key hashesh
    uint256 public ownerEmailCommitment; // hash of the owner's salted email
    IGroth16Verifier public immutable verifier; // the zk verifier for email integrity and ownership

    uint256 public constant p = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    /* is the hash(domain, pubkeyhash) valid
     ** this can be updated either by calling updateHashValidity or on the
     ** first userOp execution transaction after the hash is valid/invalid on dkimRegistry
     */
    mapping(uint256 => bool) public isHashValid;

    /* the current hash(domain, pubkeyhash) being validated
     ** this is coming from _validateSignature
     */
    uint256 public currentHash;

    error DKIMHashInvalid();

    constructor(
        IEntryPoint anEntryPoint,
        IGroth16Verifier _verifier,
        address _dkimRegistry,
        bytes32 _accountCommitment
    ) {
        _entryPoint = anEntryPoint;
        verifier = _verifier;
        dkimRegistry = _dkimRegistry;
        ownerEmailCommitment = uint256(_accountCommitment) % p;
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return _entryPoint;
    }

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256 validationData) {
        (uint[2] memory _pA, uint[2][2] memory _pB, uint[2] memory _pC, uint[3] memory _pubSignals) = abi.decode(
            userOp.signature,
            (uint[2], uint[2][2], uint[2], uint[3])
        );

        // optimizing this to return early if any of the checks fail causes gas estimation to be off by a lot in the bundler
        bool isUserOpHashValid = _pubSignals[0] == uint256(userOpHash) % p;
        bool isAccountCommitmentValid = _pubSignals[1] == ownerEmailCommitment;
        bool isProofValid = verifier.verifyProof(_pA, _pB, _pC, _pubSignals);
        bool result = isUserOpHashValid && isAccountCommitmentValid && isProofValid;

        currentHash = _pubSignals[2]; // store this for validation before executing the transaction

        return result ? 0 : 1;
    }

    modifier onlyValidDKIMHash() {
        // fetch the latest state from the dkim registry
        bool isValid = IDkimRegistry(dkimRegistry).isDKIMPublicKeyHashValid(currentHash);

        // update the cache if the state has changed
        if (isValid != isHashValid[currentHash]) {
            isHashValid[currentHash] = isValid;
            return; // we can't revert to allow they cache to be updated in the next transaction
        }

        // if the hash is invalid, revert
        if (!isHashValid[currentHash]) {
            revert DKIMHashInvalid();
        }
        _;
    }

    function execute(address dest, uint256 value, bytes calldata func) external onlyValidDKIMHash {
        _requireFromEntryPoint();
        (bool success, bytes memory result) = dest.call{ value: value }(func);

        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function updateHashValidity(uint256 _hash) external {
        isHashValid[_hash] = IDkimRegistry(dkimRegistry).isDKIMPublicKeyHashValid(_hash);
    }

    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}
}
