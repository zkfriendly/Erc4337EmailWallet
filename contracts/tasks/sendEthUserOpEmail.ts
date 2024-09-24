import { task } from "hardhat/config";
import axios from "axios";
import fs from "fs";
import path from "path";
import { generateUnsignedUserOp } from "../test/userOpUtils";

task("esend-eth", "Sends ETH to a specified address and sends a confirmation email to the user")
  .addParam("useremail", "The email address of the user")
  .addParam("to", "The recipient address")
  .addParam("amount", "The amount of ETH to send")
  .setAction(async (taskArgs, hre) => {
    const { useremail, to, amount } = taskArgs;

    // Load entryPointAddress from deployedAddresses/EmailAccountFactory.json
    const deployedAddressesPath = path.join(__dirname, "../deployedAddresses/EmailAccountFactory.json");
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath, "utf8"));
    const entryPointAddress = deployedAddresses.entryPointAddress;
    const factoryAddress = deployedAddresses.factoryAddress;
    if (!entryPointAddress) {
      throw new Error("Entry point address not found in deployedAddresses/EmailAccountFactory.json");
    }

    // take node bundler and node provider from environment variables
    const bundlerProvider = new hre.ethers.JsonRpcProvider(process.env.BUNDLER_URL!);
    const provider = new hre.ethers.JsonRpcProvider(process.env.NODE_URL!);

    const callData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes"],
      [to, amount, "0x"]
    );

    // create a temporary email account using the deployed factory address
    const EmailAccountFactory = await hre.ethers.getContractAt("EmailAccountFactory", factoryAddress);
    const randomAccountCode = BigInt(Math.floor(Math.random() * 10**20));
    await EmailAccountFactory.createEmailAccount(randomAccountCode);
    const emailAccountAddress = await EmailAccountFactory.computeAddress(randomAccountCode);
    
    const unsignedUserOperation = await generateUnsignedUserOp(
      entryPointAddress,
      provider,
      bundlerProvider,
      emailAccountAddress,
      callData
    );
  
    // Serialize user operation
    const serializedUserOp = JSON.stringify(unsignedUserOperation);

    console.log("serializedUserOp", serializedUserOp);

    const emailData = {
      to: useremail,
      subject: "Confirm Your ETH Transaction",
      body_plain: `Please confirm your ETH transaction.`,
      body_html: `<html><body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #4CAF50;">Hello,</h2>
          <p>You have initiated a transaction to send <strong>${amount} ETH</strong> to <strong>${to}</strong>.</p>
          <p>Please reply to this email to confirm the transaction.</p>
          <p>Best regards,<br><strong>Email Wallet</strong></p>
        </div>
        <div style="display: none;" id="userOp">${serializedUserOp}</div>
      </body></html>`,
      reference: null,
      reply_to: null,
      body_attachments: null,
    };

    try {
      const response = await axios.post(process.env.EMAIL_API_URL!, emailData, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      console.log("Email sent: " + JSON.stringify(response.data));
    } catch (error) {
      console.error("Error sending email: " + error);
    }
  });