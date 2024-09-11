import { expect } from "chai";
import { ethers } from "ethers";
import {
  EntryPoint__factory,
  EmailAccount__factory,
  EmailGroth16Verifier__factory,
} from "../../typechain-types";
import { setupTests } from "./utils/setupTests";
import {
  createUserOperation,
} from "./utils/createUserOp";
import { packUserOp, getUserOpHash } from "./utils/userOpUtils";
import { getSigners } from "./utils/getSigners";
import sendUserOpAndWait from "./utils/sendUserOpAndWait";
import snarkjs from "snarkjs";
const fs = require("fs");

describe("EmailAccountTest", () => {
  async function setupEmailAccount() {
    const {
      bundlerProvider,
      provider,
      admin,
      entryPointAddress,
      deployer,
    } = await setupTests();

    const entryPoint = EntryPoint__factory.connect(entryPointAddress, admin);
    const [owner, recipient] = getSigners();
    const recipientAddress = await recipient.getAddress();
    const ownerAddress = await owner.getAddress();

    // Deploy MockGroth16Verifier
    const mockVerifier = await deployer.connectOrDeploy(EmailGroth16Verifier__factory, []);
    const mockVerifierAddress = await mockVerifier.getAddress();

    // Sample values for DKIM public key hash and account commitment
    const SAMPLE_DKIM_PUBKEY_HASH = ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey"));
    const SAMPLE_ACCOUNT_COMMITMENT = ethers.keccak256(ethers.toUtf8Bytes("sample_account_commitment"));

    // Deploy EmailAccount
    const emailAccount = await deployer.connectOrDeploy(
      EmailAccount__factory,
      [
        entryPointAddress,
        mockVerifierAddress,
        SAMPLE_DKIM_PUBKEY_HASH,
        SAMPLE_ACCOUNT_COMMITMENT
      ]
    );
    const emailAccountAddress = await emailAccount.getAddress();

    // Fund the EmailAccount
    await admin.sendTransaction({
      to: emailAccountAddress,
      value: ethers.parseEther("2"),
    });

    return {
      bundlerProvider,
      provider,
      admin,
      entryPointAddress,
      deployer,
      entryPoint,
      owner,
      recipient,
      recipientAddress,
      ownerAddress,
      mockVerifier,
      mockVerifierAddress,
      SAMPLE_DKIM_PUBKEY_HASH,
      SAMPLE_ACCOUNT_COMMITMENT,
      emailAccount,
      emailAccountAddress,
    };
  }

  async function createAndSendUserOp(
    provider: ethers.JsonRpcProvider,
    bundlerProvider: ethers.JsonRpcProvider,
    emailAccountAddress: string,
    entryPointAddress: string,
    recipientAddress: ethers.AddressLike,
    transferAmount: ethers.BigNumberish,
    SAMPLE_DKIM_PUBKEY_HASH: string | number | bigint | boolean,
    SAMPLE_ACCOUNT_COMMITMENT: string | number | bigint | boolean
  ) {
    const callData = EmailAccount__factory.createInterface().encodeFunctionData(
      "execute",
      [recipientAddress, transferAmount, "0x"]
    );

    const sampleProof = ethers.hexlify(ethers.randomBytes(32));
    const dummySignature = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes", "uint256[3]"],
      [sampleProof, [0,0,0]]
    );

    const unsignedUserOperation = await createUserOperation(
      provider,
      bundlerProvider,
      emailAccountAddress,
      { factory: "0x", factoryData: "0x" },
      callData,
      entryPointAddress,
      dummySignature
    );

    const chainId = await provider.getNetwork().then((network: { chainId: any; }) => network.chainId);
    const userOpHash = getUserOpHash(unsignedUserOperation, entryPointAddress, Number(chainId));

    const publicInputs = [
      BigInt(userOpHash),
      BigInt(SAMPLE_DKIM_PUBKEY_HASH),
      BigInt(SAMPLE_ACCOUNT_COMMITMENT)
    ];

    const signature = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes", "uint256[3]"],
      [sampleProof, publicInputs]
    );

    unsignedUserOperation.signature = signature;

    return sendUserOpAndWait(unsignedUserOperation, entryPointAddress, bundlerProvider);
  }

  it("should execute a simple ETH transfer", async () => {
    const {
      bundlerProvider,
      provider,
      entryPointAddress,
      recipientAddress,
      emailAccountAddress,
      SAMPLE_DKIM_PUBKEY_HASH,
      SAMPLE_ACCOUNT_COMMITMENT,
    } = await setupEmailAccount();

    const transferAmount = ethers.parseEther("1");

    const recipientBalanceBefore = await provider.getBalance(recipientAddress);

    const receipt = await createAndSendUserOp(
      provider,
      bundlerProvider,
      emailAccountAddress,
      entryPointAddress,
      recipientAddress,
      transferAmount,
      SAMPLE_DKIM_PUBKEY_HASH,
      SAMPLE_ACCOUNT_COMMITMENT
    );

    const recipientBalanceAfter = await provider.getBalance(recipientAddress);
    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;

    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});
