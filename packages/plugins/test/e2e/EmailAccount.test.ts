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
import { packUserOp } from "./utils/userOpUtils";
import { getSigners } from "./utils/getSigners";
import sendUserOpAndWait from "./utils/sendUserOpAndWait";

describe("EmailAccountTest", () => {
  it("should execute a simple ETH transfer", async () => {
    console.log("Starting EmailAccountTest...");
    const {
      bundlerProvider,
      provider,
      admin,
      entryPointAddress,
      deployer,
    } = await setupTests();
    console.log("Test setup completed.");

    const entryPoint = EntryPoint__factory.connect(entryPointAddress, admin);
    const [owner, recipient] = getSigners();
    const recipientAddress = await recipient.getAddress();
    const ownerAddress = await owner.getAddress();
    console.log("Recipient address:", recipientAddress);
    console.log("Owner address:", ownerAddress);

    // Deploy MockGroth16Verifier
    console.log("Deploying MockGroth16Verifier...");
    const mockVerifier = await deployer.connectOrDeploy(EmailGroth16Verifier__factory, []);
    const mockVerifierAddress = await mockVerifier.getAddress();
    console.log("MockGroth16Verifier deployed at:", mockVerifierAddress);

    // Sample values for DKIM public key hash and account commitment
    const SAMPLE_DKIM_PUBKEY_HASH = ethers.keccak256(ethers.toUtf8Bytes("sample_dkim_pubkey"));
    const SAMPLE_ACCOUNT_COMMITMENT = ethers.keccak256(ethers.toUtf8Bytes("sample_account_commitment"));
    console.log("DKIM public key hash:", SAMPLE_DKIM_PUBKEY_HASH);
    console.log("Account commitment:", SAMPLE_ACCOUNT_COMMITMENT);

    // Deploy EmailAccount
    console.log("Deploying EmailAccount...");
    const emailAccount = await deployer.connectOrDeploy(
      EmailAccount__factory,
      [
        entryPointAddress,
        ownerAddress,
        mockVerifierAddress,
        SAMPLE_DKIM_PUBKEY_HASH,
        SAMPLE_ACCOUNT_COMMITMENT
      ]
    );
    const emailAccountAddress = await emailAccount.getAddress();
    console.log("EmailAccount deployed at:", emailAccountAddress);

    // Fund the EmailAccount
    console.log("Funding EmailAccount...");
    await admin.sendTransaction({
      to: emailAccountAddress,
      value: ethers.parseEther("2"),
    });
    console.log("EmailAccount funded with 2 ETH");

    const transferAmount = ethers.parseEther("1");
    console.log("Transfer amount:", ethers.formatEther(transferAmount), "ETH");

    // Prepare calldata for a simple ETH transfer
    const callData = emailAccount.interface.encodeFunctionData(
      "execute",
      [recipientAddress, transferAmount, "0x"]
    );
    console.log("Calldata prepared:", callData);

    // Sample proof data (replace with actual proof data in a real scenario)
    const sampleProof = ethers.hexlify(ethers.randomBytes(32));
    
    // Public inputs: [userOpHash, dkimPubkeyHash, accountCommitment]
    const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("sample_user_op_hash"));
    const publicInputs = [
      userOpHash,
      SAMPLE_DKIM_PUBKEY_HASH,
      SAMPLE_ACCOUNT_COMMITMENT
    ];

    // ABI encode the proof and public inputs
    const signature = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes", "uint256[3]"],
      [sampleProof, publicInputs]
    );

    const unsignedUserOperation = await createUserOperation(
      provider,
      bundlerProvider,
      emailAccountAddress,
      { factory: "0x", factoryData: "0x" },
      callData,
      entryPointAddress,
      signature,
    );
    
    const recipientBalanceBefore = await provider.getBalance(recipientAddress);
    console.log("Recipient balance before:", ethers.formatEther(recipientBalanceBefore), "ETH");

    console.log("Unsigned UserOperation:", JSON.stringify(unsignedUserOperation, null, 2));

    // Send userOp
    console.log("Sending UserOperation...");
    const receipt = await sendUserOpAndWait(unsignedUserOperation, entryPointAddress, bundlerProvider);
    console.log("UserOperation sent. Transaction hash:", receipt.success);

    const recipientBalanceAfter = await provider.getBalance(recipientAddress);
    console.log("Recipient balance after:", ethers.formatEther(recipientBalanceAfter), "ETH");

    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;
    console.log("Expected recipient balance:", ethers.formatEther(expectedRecipientBalance), "ETH");

    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
    console.log("Test completed successfully.");
  });
});
