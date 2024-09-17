import { expect } from "chai";
import { ethers } from "hardhat";
import {
    EmailAccount__factory,
    EmailAccountDummyVerifier__factory,
    EmailAccountDummyVerifier,
    HMockDkimRegistry,
    HMockDkimRegistry__factory,
    EmailAccount,
} from "../../typechain-types";
import { setupTests } from "./utils/setupTests";
import { createUserOperation } from "./utils/createUserOp";
import { getUserOpHash } from "./utils/userOpUtils";
import { getSigners } from "./utils/getSigners";
import sendUserOpAndWait from "./utils/sendUserOpAndWait";
import { eSign, mockProver } from "./utils/emailAccount";
import { JsonRpcProvider, NonceManager, Signer } from "ethers";
import DeterministicDeployer from "../../lib-ts/deterministic-deployer/DeterministicDeployer";

describe("EmailAccountTest", () => {
    let context: {
        bundlerProvider: JsonRpcProvider;
        provider: JsonRpcProvider;
        admin: NonceManager;
        owner: NonceManager;
        otherAccount: NonceManager;
        entryPointAddress: string;
        deployer: DeterministicDeployer;
    };

    let verifier: EmailAccountDummyVerifier;
    let dkimRegistry: HMockDkimRegistry;
    let emailAccount: EmailAccount;
    let owner: Signer;
    let recipient: Signer;
    let recipientAddress: string;
    let domainPubKeyHash: bigint;
    let accountCommitment: bigint;

    const p = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    const transferAmount = ethers.parseEther("1");

    beforeEach(async () => {
        context = await setupTests();
        [owner, recipient] = getSigners();
        recipientAddress = await recipient.getAddress();
        verifier = await context.deployer.connectOrDeploy(EmailAccountDummyVerifier__factory, []);
        dkimRegistry = await context.deployer.connectOrDeploy(HMockDkimRegistry__factory, []);

        domainPubKeyHash = BigInt(ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey"))) % BigInt(p);
        accountCommitment = BigInt(ethers.keccak256(ethers.toUtf8Bytes("sample_account_commitment"))) % BigInt(p);

        emailAccount = await context.deployer.connectOrDeploy(EmailAccount__factory, [
            context.entryPointAddress,
            await verifier.getAddress(),
            await dkimRegistry.getAddress(),
            accountCommitment.toString(),
        ]);

        // Fund the EmailAccount
        await context.admin.sendTransaction({
            to: await emailAccount.getAddress(),
            value: ethers.parseEther("20"),
        });
    });

    it("should load the mock prover", async () => {
        const input = {
            userOpHashIn: "0x0",
            emailCommitmentIn: "0x1",
            pubkeyHashIn: "0x2",
        };

        const { proof, publicSignals, solidityCalldata } = await mockProver(input);

        const factory = await ethers.getContractFactory("EmailAccountDummyVerifier");
        const verifier = await factory.deploy();

        const result = await verifier.verifyProof(
            solidityCalldata[0],
            solidityCalldata[1],
            solidityCalldata[2],
            publicSignals
        );

        expect(result).to.be.true;
        expect(proof).to.exist;
        expect(publicSignals).to.exist;
        expect(publicSignals).to.deep.equal(Object.values(input));
    });

    it("should execute a simple ETH transfer", async () => {
        await assertSendEth(transferAmount);
    });

    it("should send 2 more eth twice", async () => {
        await assertSendEth(ethers.parseEther("2"));
        await assertSendEth(ethers.parseEther("2"));
    });

    it("should not be able to reuse the same signature on similar userOps", async () => {
        const callData = emailAccount.interface.encodeFunctionData("execute", [recipientAddress, transferAmount, "0x"]);
        const userOp1 = await prepareUserOp(callData);
        const userOp2 = await createUserOperation(
            context.provider,
            context.bundlerProvider,
            await emailAccount.getAddress(),
            { factory: "0x", factoryData: "0x" },
            callData,
            context.entryPointAddress,
            userOp1.signature
        );

        await sendUserOpAndWait(userOp1, context.entryPointAddress, context.bundlerProvider);
        expect(sendUserOpAndWait(userOp2, context.entryPointAddress, context.bundlerProvider)).to.be.rejected;
    });

    it("should send eth with a different valid domain pubkey hash", async () => {
        domainPubKeyHash = BigInt(ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey_2"))) % BigInt(p); // will reset on each test case
        await assertSendEth(transferAmount);
    });

    it("should be able to still use the old valid domain pubkey hash", async () => {
        await assertSendEth(transferAmount);
    });

    it("should not fail to transfer on first tx after new valid domain pubkey hash", async () => {
        domainPubKeyHash = BigInt(ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey_3"))) % BigInt(p);
        await assertSendEth(transferAmount);
    });

    it("should not fail to transfer on second tx after new valid domain pubkey hash", async () => {
        domainPubKeyHash = BigInt(ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey_3"))) % BigInt(p);
        await assertSendEth(transferAmount);
    });

    it("should fail with invalid domain pubkey hash", async () => {
        domainPubKeyHash = BigInt(5); // means that the domain pubkey hash is invalid
        await expect(assertSendEth(transferAmount)).to.be.rejected; // todo: rejects because it has invalid domain pubkey hash
    });

    it("should fail with invalid account commitment", async () => {
        accountCommitment = BigInt(5); // means that the account commitment is invalid
        await expect(assertSendEth(transferAmount)).to.be.rejected;
    });

    async function prepareUserOp(callData: string) {
        // used for gas estimation simulation
        const dummySignature = await eSign({
            userOpHashIn: "0x0",
            emailCommitmentIn: accountCommitment.toString(),
            pubkeyHashIn: domainPubKeyHash.toString(),
        });

        const unsignedUserOperation = await createUserOperation(
            context.provider,
            context.bundlerProvider,
            await emailAccount.getAddress(),
            { factory: "0x", factoryData: "0x" },
            callData,
            context.entryPointAddress,
            dummySignature // Temporary placeholder for signature
        );

        // Calculate userOpHash
        const chainId = await context.provider.getNetwork().then(network => network.chainId);
        let userOpHash = getUserOpHash(unsignedUserOperation, context.entryPointAddress, Number(chainId));

        // Update the userOperation with the calculated signature
        let signedUserOperation = unsignedUserOperation;
        signedUserOperation.signature = await eSign({
            userOpHashIn: userOpHash,
            emailCommitmentIn: accountCommitment.toString(),
            pubkeyHashIn: domainPubKeyHash.toString(),
        });
        return signedUserOperation;
    }

    async function assertSendEth(amount: bigint) {
        const recipientBalanceBefore = await context.provider.getBalance(recipientAddress);
        const callData = emailAccount.interface.encodeFunctionData("execute", [recipientAddress, amount, "0x"]);
        const userOp = await prepareUserOp(callData);
        await sendUserOpAndWait(userOp, context.entryPointAddress, context.bundlerProvider);
        const recipientBalanceAfter = await context.provider.getBalance(recipientAddress);
        const expectedRecipientBalance = recipientBalanceBefore + amount;
        expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
    }
});
