// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {HandlerContext} from "safe-contracts/contracts/handler/HandlerContext.sol";

import {BaseAccount} from "account-abstraction/contracts/core/BaseAccount.sol";
import {IEntryPoint, UserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {UserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";

import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

interface ISafe {
    function enableModule(address module) external;

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success);
}

struct ECDSAOwnerStorage {
    address owner;
}

contract SafeECDSAPlugin is BaseAccount, HandlerContext {
    using ECDSA for bytes32;

    mapping(address => ECDSAOwnerStorage) public ecdsaOwnerStorage;

    address public immutable myAddress; // Module address
    address private immutable _entryPoint;

    address internal constant _SENTINEL_MODULES = address(0x1);

    error NONCE_NOT_SEQUENTIAL();
    event OWNER_UPDATED(address indexed safe, address indexed oldOwner, address indexed newOwner);

    constructor(address entryPointAddress) {
        myAddress = address(this);
        _entryPoint = entryPointAddress;
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override returns (uint256 validationData) {
        _validateNonce(userOp.nonce);
        validationData = _validateSignature(userOp, userOpHash);
        _payPrefund(missingAccountFunds);
    }

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable fromThisOrEntryPoint {
        address payable safeAddress = payable(msg.sender);
        ISafe safe = ISafe(safeAddress);
        require(
            safe.execTransactionFromModule(to, value, data, 0),
            "tx failed"
        );
    }

    function enableMyself(address ownerKey) public {
        ISafe(address(this)).enableModule(myAddress);

        // Enable the safe address with the defined key
        bytes memory _data = abi.encodePacked(ownerKey);
        SafeECDSAPlugin(myAddress).enable(_data);
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(_entryPoint);
    }

    function enable(bytes calldata _data) external payable {
        address newOwner = address(bytes20(_data[0:20]));
        address oldOwner = ecdsaOwnerStorage[msg.sender].owner;
        ecdsaOwnerStorage[msg.sender].owner = newOwner;
        emit OWNER_UPDATED(msg.sender, oldOwner, newOwner);
    }

    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view override returns (uint256 validationData) {
        address keyOwner = ecdsaOwnerStorage[msg.sender].owner;
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        if (keyOwner != hash.recover(userOp.signature))
            return SIG_VALIDATION_FAILED;
        return 0;
    }

    /**
     * Ensures userOp nonce is sequential. Nonce uniqueness is already managed by the EntryPoint.
     * This function prevents using a “key” different from the first “zero” key.
     * @param nonce to validate
     */
    function _validateNonce(uint256 nonce) internal pure override {
        if (nonce >= type(uint64).max) {
            revert NONCE_NOT_SEQUENTIAL();
        }
    }

    /**
     * This function is overridden as this plugin does not hold funds, so the transaction
     * has to be executed from the sender Safe
     * @param missingAccountFunds The minimum value this method should send to the entrypoint
     */
    function _payPrefund(uint256 missingAccountFunds) internal override {
        address payable safeAddress = payable(msg.sender);
        ISafe senderSafe = ISafe(safeAddress);

        if (missingAccountFunds != 0) {
            senderSafe.execTransactionFromModule(
                _entryPoint,
                missingAccountFunds,
                "",
                0
            );
        }
    }

    modifier fromThisOrEntryPoint() {
        require(
            _msgSender() == address(this) ||
            _msgSender() == _entryPoint
        );
        _;
    }
}
