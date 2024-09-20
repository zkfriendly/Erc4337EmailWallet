import { ethers, ignition } from "hardhat";
import { JsonRpcProvider, Signer, ethers as ethers2 } from "ethers";
import {
  EmailAccount,
  EmailAccountDummyVerifier,
  HMockDkimRegistry,
} from "../typechain-types";
import { eSign, mockProver } from "./utils";
import sendUserOpAndWait, {
  createUserOperation,
  getUserOpHash,
} from "./userOpUtils";
import { expect } from "chai";
import { EntryPoint__factory } from "../lib/account-abstraction/typechain";

// const EmailAccountModule = buildModule("EmailAccount", (m) => {
//   const entryPointAddress = m.getParameter("entryPointAddress", "0x0");
//   const verifierAddress = m.getParameter("verifierAddress", "0x0");
//   const dkimRegistryAddress = m.getParameter("dkimRegistryAddress", "0x0");
//   const accountCommitment = m.getParameter("accountCommitment", "0x0");

//   console.log("entryPointAddress", entryPointAddress);
//   console.log("verifierAddress", verifierAddress);
//   console.log("dkimRegistryAddress", dkimRegistryAddress);
//   console.log("accountCommitment", accountCommitment);

//   const emailAccount = m.contract("EmailAccount", [
//     entryPointAddress,
//     verifierAddress,
//     dkimRegistryAddress,
//     accountCommitment,
//   ]);

//   return { emailAccount };
// });

describe("EmailAccountTest", () => {
  let context: {
    bundlerProvider: JsonRpcProvider;
    provider: JsonRpcProvider;
    admin: Signer;
    owner: Signer;
    entryPointAddress: string;
  };

  let verifier: EmailAccountDummyVerifier;
  let dkimRegistry: HMockDkimRegistry;
  let emailAccount: EmailAccount;
  let owner: Signer;
  let recipient: Signer;
  let recipientAddress: string;
  let domainPubKeyHash: bigint;
  let accountCommitment: bigint;

  const p = BigInt(
    "21888242871839275222246405745257275088548364400416034343698204186575808495617"
  );
  const transferAmount = ethers.parseEther("1");

  async function setupTests() {
    const [admin, owner] = await ethers.getSigners();
    const provider = new ethers.JsonRpcProvider("http://localhost:8545");
    const bundlerProvider = new ethers.JsonRpcProvider(
      "http://localhost:3000/rpc"
    );

    // get list of supported entrypoints
    const entrypoints = await bundlerProvider.send(
      "eth_supportedEntryPoints",
      []
    );

    if (entrypoints.length === 0) {
      throw new Error("No entrypoints found");
    }

    return {
      bundlerProvider,
      provider,
      admin,
      owner,
      recipient,
      entryPointAddress: entrypoints[0],
    };
  }

  async function deploy(factoryName: string, args: any[]) {
    const factory = await ethers.getContractFactory(factoryName);
    return await factory.deploy(...args);
  }

  beforeEach(async () => {
    context = await setupTests();
    [owner, recipient] = await ethers.getSigners();
    recipientAddress = await recipient.getAddress();
    verifier = (await deploy(
      "EmailAccountDummyVerifier",
      []
    )) as EmailAccountDummyVerifier;
    dkimRegistry = (await deploy("HMockDkimRegistry", [])) as HMockDkimRegistry;

    domainPubKeyHash =
      BigInt(ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey"))) %
      BigInt(p);
    accountCommitment =
      BigInt(
        ethers.keccak256(ethers.toUtf8Bytes("sample_account_commitment"))
      ) % BigInt(p);

    const factory = await ethers.getContractFactory("EmailAccount");
    emailAccount = await factory.deploy(
      context.entryPointAddress,
      await verifier.getAddress(),
      await dkimRegistry.getAddress(),
      accountCommitment
    );

    // Fund the EmailAccount
    await context.admin.sendTransaction({
      to: await emailAccount.getAddress(),
      value: ethers.parseEther("20"),
    });

    // make sure entrypoint is a contract
  });

  it("should just work", async () => {
    expect(true).to.be.true;
  });

  it("should load the mock prover", async () => {
    const input = {
      userOpHashIn: "0x0",
      emailCommitmentIn: "0x1",
      pubkeyHashIn: "0x2",
    };

    const { proof, publicSignals, solidityCalldata } = await mockProver(input);

    const factory = await ethers.getContractFactory(
      "EmailAccountDummyVerifier"
    );
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

  // it("should send 2 more eth twice", async () => {
  //   await assertSendEth(ethers.parseEther("2"));
  //   await assertSendEth(ethers.parseEther("2"));
  // });

  // it("should not be able to reuse the same signature on similar userOps", async () => {
  //   const callData = emailAccount.interface.encodeFunctionData("execute", [
  //     recipientAddress,
  //     transferAmount,
  //     "0x",
  //   ]);
  //   const userOp1 = await prepareUserOp(callData);
  //   const userOp2 = await createUserOperation(
  //     context.provider,
  //     context.bundlerProvider,
  //     await emailAccount.getAddress(),
  //     { factory: "0x", factoryData: "0x" },
  //     callData,
  //     context.entryPointAddress,
  //     userOp1.signature
  //   );

  //   await sendUserOpAndWait(
  //     userOp1,
  //     context.entryPointAddress,
  //     context.bundlerProvider
  //   );
  //   expect(
  //     sendUserOpAndWait(
  //       userOp2,
  //       context.entryPointAddress,
  //       context.bundlerProvider
  //     )
  //   ).to.be.rejected;
  // });

  // it("should send eth with a different valid domain pubkey hash", async () => {
  //   domainPubKeyHash =
  //     BigInt(ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey_2"))) %
  //     BigInt(p); // will reset on each test case
  //   await assertSendEth(transferAmount);
  // });

  // it("should be able to still use the old valid domain pubkey hash", async () => {
  //   await assertSendEth(transferAmount);
  // });

  // it("should not fail to transfer on first tx after new valid domain pubkey hash", async () => {
  //   domainPubKeyHash =
  //     BigInt(ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey_3"))) %
  //     BigInt(p);
  //   await assertSendEth(transferAmount);
  // });

  // it("should not fail to transfer on second tx after new valid domain pubkey hash", async () => {
  //   domainPubKeyHash =
  //     BigInt(ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey_3"))) %
  //     BigInt(p);
  //   await assertSendEth(transferAmount);
  // });

  // it("should fail with invalid domain pubkey hash", async () => {
  //   domainPubKeyHash = BigInt(5); // means that the domain pubkey hash is invalid
  //   await expect(assertSendEth(transferAmount)).to.be.rejected; // todo: rejects because it has invalid domain pubkey hash
  // });

  // it("should fail with invalid account commitment", async () => {
  //   accountCommitment = BigInt(5); // means that the account commitment is invalid
  //   await expect(assertSendEth(transferAmount)).to.be.rejected;
  // });

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
    const chainId = await context.provider
      .getNetwork()
      .then((network) => network.chainId);
    let userOpHash = getUserOpHash(
      unsignedUserOperation,
      context.entryPointAddress,
      Number(chainId)
    );

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
    const recipientBalanceBefore = await context.provider.getBalance(
      recipientAddress
    );
    const callData = emailAccount.interface.encodeFunctionData("execute", [
      recipientAddress,
      amount,
      "0x",
    ]);
    const userOp = await prepareUserOp(callData);
    await sendUserOpAndWait(
      userOp,
      context.entryPointAddress,
      context.bundlerProvider
    );
    const recipientBalanceAfter = await context.provider.getBalance(
      recipientAddress
    );
    const expectedRecipientBalance = recipientBalanceBefore + amount;
    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  }
});
