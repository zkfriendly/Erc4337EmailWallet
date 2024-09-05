import { expect } from "chai";
import { ethers } from "ethers";
import {
  EntryPoint__factory,
  EmailAccount__factory,
} from "../../typechain-types";
import { setupTests } from "./utils/setupTests";
import receiptOf from "./utils/receiptOf";
import {
  createUserOperation,
} from "./utils/createUserOp";
import { packUserOp } from "./utils/userOpUtils";
import { getSigners } from "./utils/getSigners";
import sendUserOpAndWait from "./utils/sendUserOpAndWait";

describe("EmailAccountTest", () => {
  it("should execute a simple ETH transfer", async () => {
    const {
      bundlerProvider,
      provider,
      admin,
      entryPointAddress,
      deployer,
    } = await setupTests();

    const entryPoint = EntryPoint__factory.connect(entryPointAddress, admin);
    console.log("EntryPoint address:", entryPointAddress);
    console.log("Admin address:", await admin.getAddress());
    console.log("Provider network:", await provider.getNetwork());
    console.log("BundlerProvider network:", await bundlerProvider.getNetwork());
    const [owner, recipient] = getSigners();
    const recipientAddress = await recipient.getAddress();
    const ownerAddress = await owner.getAddress();

    console.log("Recipient address:", recipientAddress);
    console.log("Owner address:", ownerAddress);
    

    // Deploy EmailAccount
    const emailAccount = await deployer.connectOrDeploy(EmailAccount__factory, [entryPointAddress, ownerAddress]);
    const emailAccountAddress = await emailAccount.getAddress();

    console.log("EmailAccount address:", emailAccountAddress);
    

    // Fund the EmailAccount
    await admin.sendTransaction({
      to: emailAccountAddress,
      value: ethers.parseEther("2"),
    });

    console.log("EmailAccount funded");

    const transferAmount = ethers.parseEther("1");

    // Prepare calldata for a simple ETH transfer
    const callData = emailAccount.interface.encodeFunctionData(
      "execute",
      [recipientAddress, transferAmount, "0x"]
    );

    console.log("Calldata for ETH transfer:", callData);

    const unsignedUserOperation = await createUserOperation(
      provider,
      bundlerProvider,
      emailAccountAddress,
      { factory: "0x", factoryData: "0x" }, // Factory params with zero address for already deployed account
      callData,
      entryPointAddress,
      "0x",
    );
    
    const packedUserOperation = packUserOp(unsignedUserOperation);

    const recipientBalanceBefore = await provider.getBalance(recipientAddress);

    console.log("unsignedUserOperation", unsignedUserOperation);

    // Send userOp
    const receipt = await sendUserOpAndWait(unsignedUserOperation, entryPointAddress, bundlerProvider);
    
    const recipientBalanceAfter = await provider.getBalance(recipientAddress);

    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;

    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});
