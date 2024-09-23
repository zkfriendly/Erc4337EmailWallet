import { expect } from "chai";
import { ethers } from "hardhat";
import { EmailAccountFactory, EmailAccount, MockContract } from "../typechain";



describe("EmailAccountFactory", function () {
    let emailAccountFactory: EmailAccountFactory;
    let emailAccount: EmailAccount;
    let entryPoint: MockContract;
    let verifier: MockContract;
    let dkimRegistry: MockContract;
    let ownerEmailCommitment: string;

    beforeEach(async function () {
        // Deploy mock contracts for entryPoint, verifier, and dkimRegistry
        const MockContract = await ethers.getContractFactory("MockContract");
        entryPoint = await MockContract.deploy();
        verifier = await MockContract.deploy();
        dkimRegistry = await MockContract.deploy();

        // Deploy the EmailAccountFactory contract
        const EmailAccountFactory = await ethers.getContractFactory("EmailAccountFactory");
        emailAccountFactory = await EmailAccountFactory.deploy(await entryPoint.getAddress(), await verifier.getAddress(), await dkimRegistry.getAddress());

        // Set a sample ownerEmailCommitment - in reality this Poseidon(email, accountCode)
        ownerEmailCommitment = "0x1234"
    });

    it("should create a new EmailAccount", async function () {
        await emailAccountFactory.createEmailAccount(ownerEmailCommitment);

        const expectedAddress = await emailAccountFactory.computeAddress(ownerEmailCommitment);

        // Verify the EmailAccount contract was deployed correctly
        const EmailAccount = await ethers.getContractFactory("EmailAccount");
        emailAccount = EmailAccount.attach(expectedAddress);

        expect(await emailAccount.ownerEmailCommitment()).to.equal(ownerEmailCommitment);
        expect(await emailAccount.entryPoint()).to.equal(await entryPoint.getAddress());
        expect(await emailAccount.verifier()).to.equal(await verifier.getAddress());
        expect(await emailAccount.dkimRegistry()).to.equal(await dkimRegistry.getAddress());
    });
});