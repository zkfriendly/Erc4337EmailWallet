import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { EmailAccountFactory } from "../typechain";

describe("EmailAccountFactory", function () {
    let EmailAccountFactory: EmailAccountFactory;
    let emailAccountFactory: EmailAccountFactory;
    let EmailAccount: ContractFactory;
    let emailAccount: Contract;
    let entryPoint: Contract;
    let verifier: Contract;
    let dkimRegistry: Contract;
    let ownerEmailCommitment: string;

    beforeEach(async function () {
        // Deploy mock contracts for entryPoint, verifier, and dkimRegistry
        const MockContract: ContractFactory = await ethers.getContractFactory("MockContract");
        entryPoint = await MockContract.deploy();
        verifier = await MockContract.deploy();
        dkimRegistry = await MockContract.deploy();

        console.log("entryPoint", await entryPoint.getAddress());
        console.log("verifier", await verifier.getAddress());
        console.log("dkimRegistry", await dkimRegistry.getAddress());

        // Deploy the EmailAccountFactory contract
        EmailAccountFactory = await ethers.getContractFactory("EmailAccountFactory");
        emailAccountFactory = await EmailAccountFactory.deploy(await entryPoint.getAddress(), await verifier.getAddress(), await dkimRegistry.getAddress());

        // Set a sample ownerEmailCommitment - in reality this Poseidon(email, accountCode)
        ownerEmailCommitment = ethers.keccak256(ethers.toUtf8Bytes("owner@example.com"));
    });

    it("should create a new EmailAccount", async function () {
        const tx = await emailAccountFactory.createEmailAccount(ownerEmailCommitment);
        const expectedAddress = await emailAccountFactory.computeEmailAccountAddress(ownerEmailCommitment);

        // Verify the EmailAccount contract was deployed correctly
        EmailAccount = await ethers.getContractFactory("EmailAccount");
        emailAccount = EmailAccount.attach(expectedAddress);

        expect(await emailAccount.ownerEmailCommitment()).to.equal(ownerEmailCommitment);
        expect(await emailAccount.entryPoint()).to.equal(await entryPoint.getAddress());
        expect(await emailAccount.verifier()).to.equal(await verifier.getAddress());
        expect(await emailAccount.dkimRegistry()).to.equal(await dkimRegistry.getAddress());
    });
});