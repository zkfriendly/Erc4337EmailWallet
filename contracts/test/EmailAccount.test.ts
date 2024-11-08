import { ethers } from "hardhat";
import { JsonRpcProvider, Signer } from "ethers";
import {
  EmailAccount,
  EmailAccountDummyVerifier,
  HMockDkimRegistry,
} from "../typechain";
import { eSign, mockProver } from "../scripts/utils/prover";
import { generateUnsignedUserOp } from "../scripts/utils/userOpUtils";
import sendUserOpAndWait, {
  createUserOperation,
  getUserOpHash,
} from "../scripts/utils/userOpUtils";
import { expect } from "chai";

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

  const transferAmount = ethers.parseEther("1");

  async function setupTests() {
    const [admin, owner] = await ethers.getSigners();
    const provider = new ethers.JsonRpcProvider("http://localhost:8545");

    const bundlerProvider = new ethers.JsonRpcProvider(
      process.env.BUNDLER === "unsafe" ? "http://localhost:3002/rpc" : "http://localhost:3000/rpc"
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

  before(async () => {
    console.log("\n🚀 Initializing Email Account Test Suite...");

    const bundlerMode = process.env.BUNDLER === 'unsafe' ? '⚠️  UNSAFE' : '🔒 SAFE';
    const bundlerPort = process.env.BUNDLER === 'unsafe' ? '3002' : '3000';

    console.log("\n🔧 Environment Configuration:");
    console.log(`  ├─ BUNDLER: ${bundlerMode} (port ${bundlerPort})`);
    console.log(`  └─ STAKE_ACCOUNT: ${process.env.STAKE_ACCOUNT || 'false'}`);

    context = await setupTests();
    [owner, recipient] = await ethers.getSigners();

    console.log("\n📋 Test Configuration:");
    console.log("  ├─ Owner Address:", await owner.getAddress());
    console.log("  ├─ Owner Balance:", ethers.formatEther(await context.provider.getBalance(await owner.getAddress())), "ETH");
    console.log("  ├─ EntryPoint:", context.entryPointAddress);
    console.log(`  └─ Bundler URL: http://localhost:${bundlerPort}/rpc (${bundlerMode})`);

    recipientAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
    const verifierFactory = await ethers.getContractFactory(
      "EmailAccountDummyVerifier"
    );
    verifier = await verifierFactory.deploy();
    console.log("\n🔧 Deploying Contracts:");
    console.log("  ├─ Verifier deployed to:", await verifier.getAddress());

    const dkimRegistryFactory = await ethers.getContractFactory(
      "HMockDkimRegistry"
    );
    dkimRegistry = await dkimRegistryFactory.deploy();
    console.log("  ├─ DKIM Registry deployed to:", await dkimRegistry.getAddress());

    domainPubKeyHash = BigInt(
      ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey"))
    );
    accountCommitment = BigInt(
      ethers.keccak256(ethers.toUtf8Bytes("sample_account_commitment"))
    );

    const factory = await ethers.getContractFactory("EmailAccountFactory");
    const emailAccountFactory = await factory.deploy(
      context.entryPointAddress,
      await verifier.getAddress(),
      await dkimRegistry.getAddress()
    );
    await emailAccountFactory.waitForDeployment();
    console.log("  └─ Email Account Factory deployed to:", await emailAccountFactory.getAddress());

    // deploy the email account using the factory
    console.log("\n📬 Creating Email Account:");
    await emailAccountFactory.createEmailAccount(accountCommitment);
    emailAccount = await ethers.getContractAt("EmailAccount", await emailAccountFactory.computeAddress(accountCommitment));
    console.log("  └─ Email Account created at:", await emailAccount.getAddress());

    // fund the account from owner's account
    const fundingAmount = ethers.parseEther("1000");
    console.log("\n💰 Funding Account:");
    console.log("  └─ Sending", ethers.formatEther(fundingAmount), "ETH to Email Account");
    await owner.sendTransaction({
      to: await emailAccount.getAddress(),
      value: fundingAmount
    });

    // Only add stake if STAKE_ACCOUNT environment variable is set to true
    if (process.env.STAKE_ACCOUNT === 'true') {
      console.log("\n🔒 Adding Stake:");
      console.log("  └─ Staking 1 ETH to account");
      await emailAccount.addStake(1, { value: ethers.parseEther("1") });
    } else {
      console.log("\nℹ️  Stake Status:");
      console.log("  └─ Skipping account staking (STAKE_ACCOUNT not set)");
    }

    console.log("\n✅ Setup Complete!\n");
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

  it("should update the DKIM public key hash cache", async () => {
    await updateDKIMPublicKeyHashCache(domainPubKeyHash);
  });

  it("should execute a simple ETH transfer", async () => {
    await assertSendEth(transferAmount);
  });

  it("should send 2 more eth twice", async () => {
    await assertSendEth(ethers.parseEther("2"));
    await assertSendEth(ethers.parseEther("2"));
  });

  it("should not be able to reuse the same signature on similar userOps", async () => {
    const callData = emailAccount.interface.encodeFunctionData("execute", [
      recipientAddress,
      transferAmount,
      "0x",
    ]);
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

    await sendUserOpAndWait(
      userOp1,
      context.entryPointAddress,
      context.bundlerProvider
    );
    expect(
      sendUserOpAndWait(
        userOp2,
        context.entryPointAddress,
        context.bundlerProvider
      )
    ).to.be.rejected;
  });

  it("should send eth with a different valid domain pubkey hash", async () => {
    domainPubKeyHash = BigInt(
      ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey_2"))
    );
    await updateDKIMPublicKeyHashCache(domainPubKeyHash);
    await assertSendEth(transferAmount);
  });

  it("should be able to still use the old valid domain pubkey hash", async () => {
    await assertSendEth(transferAmount);
  });

  it("should fail to transfer on first tx after new valid domain pubkey hash", async () => {
    domainPubKeyHash = BigInt(
      ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey_3"))
    );
    await expect(assertSendEth(transferAmount)).to.be.rejected;
  });

  it("should not fail to transfer on tx after new valid domain pubkey hash update", async () => {
    domainPubKeyHash = BigInt(
      ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey_3"))
    );
    await updateDKIMPublicKeyHashCache(domainPubKeyHash);
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
    const unsignedUserOperation = await generateUnsignedUserOp(
      context.entryPointAddress,
      context.provider,
      context.bundlerProvider,
      await emailAccount.getAddress(),
      callData
    );
    return await signUserOp(unsignedUserOperation);
  }

  async function signUserOp(unsignedUserOperation: any) {
    const chainId = await context.provider
      .getNetwork()
      .then((network) => network.chainId);
    const userOpHash = getUserOpHash(
      unsignedUserOperation,
      context.entryPointAddress,
      Number(chainId)
    );

    unsignedUserOperation.signature = await eSign({
      userOpHashIn: userOpHash,
      emailCommitmentIn: accountCommitment.toString(),
      pubkeyHashIn: domainPubKeyHash.toString(),
    });

    return unsignedUserOperation;
  }

  async function updateDKIMPublicKeyHashCache(domainPubKeyHash: bigint) {
    await emailAccount.updateDKIMPublicKeyHashCache("example.com", domainPubKeyHash);
    await emailAccount.waitForDeployment();
    const cache = await emailAccount.isDKIMPublicKeyHashValidCache("example.com", domainPubKeyHash);
    expect(cache).to.be.true;
  }

  async function assertSendEth(amount: bigint) {
    const recipientBalanceBefore = await context.provider.getBalance(
      recipientAddress
    );

    const executeFunctionSelector = "0x" + ethers.id("execute(address,uint256,bytes)").slice(2, 10);
    const callData = executeFunctionSelector + ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes"],
      [recipientAddress, amount, "0x"]
    ).slice(2);

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
