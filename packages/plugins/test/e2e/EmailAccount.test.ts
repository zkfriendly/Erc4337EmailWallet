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
    let domainPubKeyHash: string;
    let accountCommitment: string;

    beforeEach(async () => {
        context = await setupTests();
        [owner, recipient] = getSigners();
        verifier = await context.deployer.connectOrDeploy(EmailAccountDummyVerifier__factory, []);
        dkimRegistry = await context.deployer.connectOrDeploy(HMockDkimRegistry__factory, []);

        domainPubKeyHash = ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey"));
        accountCommitment = ethers.keccak256(ethers.toUtf8Bytes("sample_account_commitment"));

        emailAccount = await context.deployer.connectOrDeploy(EmailAccount__factory, [
            context.entryPointAddress,
            await verifier.getAddress(),
            await dkimRegistry.getAddress(),
            accountCommitment,
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
        const recipientAddress = await recipient.getAddress();
        const transferAmount = ethers.parseEther("1");
        const recipientBalanceBefore = await context.provider.getBalance(recipientAddress);
        const callData = emailAccount.interface.encodeFunctionData("execute", [recipientAddress, transferAmount, "0x"]);
        const userOp = await prepareUserOp(recipientAddress, callData);
        await sendUserOpAndWait(userOp, context.entryPointAddress, context.bundlerProvider);
        const recipientBalanceAfter = await context.provider.getBalance(recipientAddress);
        const expectedRecipientBalance = recipientBalanceBefore + transferAmount;
        expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
    });

    async function prepareUserOp(recipientAddress: string, callData: string) {
        // used for gas estimation simulation
        const dummySignature = await eSign({
            userOpHashIn: "0x0",
            emailCommitmentIn: accountCommitment,
            pubkeyHashIn: domainPubKeyHash,
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

        const publicInputs = {
            userOpHashIn: userOpHash,
            emailCommitmentIn: accountCommitment,
            pubkeyHashIn: domainPubKeyHash,
        };

        // Update the userOperation with the calculated signature
        let signedUserOperation = unsignedUserOperation;
        signedUserOperation.signature = await eSign(publicInputs);
        return signedUserOperation;
    }
});
