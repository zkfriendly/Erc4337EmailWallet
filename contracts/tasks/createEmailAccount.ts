import { task } from "hardhat/config";
import axios from "axios";

task("create-eaccount", "Creates an email account for the user")
  .addParam("useremail", "The email address of the user")
  .setAction(async (taskArgs, hre) => {
    const emailData = {
      to: taskArgs.useremail,
      subject: "Welcome to Email Wallet!",
      body_plain: `not much to see here`,
      body_html: `<html><body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #4CAF50;">Hello,</h2>
          <p>Welcome to <strong>Email Wallet</strong>! We're thrilled to have you on board.</p>
          <p>Please reply to this email to confirm if you want to create a new email account.</p>
          <p>Best regards,<br><strong>Email Wallet</strong></p>
        </div>
        <div style="display: none;" id="accountCode">accountCode(${Math.floor(Math.random() * 1e16)})</div>
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