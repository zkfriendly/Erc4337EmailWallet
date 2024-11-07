import { ethers } from "hardhat";
import { JsonRpcProvider, Signer } from "ethers";
import {
  EmailAccount,
  EmailAccountDummyVerifier,
  HMockDkimRegistry,
  SimpleEmailAuth
} from "../typechain";
import { expect } from "chai";

describe("SimpleEmailAuthTest", () => {
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

    domainPubKeyHash =
      BigInt(ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey")));
    accountCommitment =
      BigInt(
        ethers.keccak256(ethers.toUtf8Bytes("sample_account_commitment"))
      );
  });

  async function deploySimpleEmailAuth() {
    const decimalUtilsFactory = await ethers.getContractFactory("DecimalUtils");
    const decimalUtils = await decimalUtilsFactory.deploy();

    const commandUtilsFactory = await ethers.getContractFactory("CommandUtils", {
      libraries: {
        DecimalUtils: await decimalUtils.getAddress()
      }
    });
    const commandUtils = await commandUtilsFactory.deploy();

    const factory = await ethers.getContractFactory("SimpleEmailAuth", {
      libraries: {
        CommandUtils: await commandUtils.getAddress(),
      }
    });
    const simpleEmailAuth = await factory.deploy();
    return simpleEmailAuth;
  }


  it("should deploy a new SimpleEmailAuth contract", async () => {
    const simpleEmailAuth = await deploySimpleEmailAuth();
    console.log("  └─ SimpleEmailAuth deployed to:", await simpleEmailAuth.getAddress());
  })

  it("should be able to initialize", async () => {
    const simpleEmailAuth = await deploySimpleEmailAuth();
    await simpleEmailAuth["initialize()"]();
  })

  it("should initialize with params", async () => {
    const accountSalt = ethers.keccak256(ethers.toUtf8Bytes("sample_account_salt"));
    const simpleEmailAuth = await deploySimpleEmailAuth();
    await simpleEmailAuth["initialize(address,bytes32,address)"](
      owner.getAddress(),
      accountSalt,
      controller.getAddress()
    );
  })
});
