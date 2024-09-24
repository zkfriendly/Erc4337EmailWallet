# ERC4337 Email Wallet

This project implements an Email Wallet using the ERC4337 standard.

## 🚀 Quick Start

### Prerequisites

- [Docker](https://www.docker.com/) installed and running
- [Node.js](https://nodejs.org/) and npm (or [Yarn](https://yarnpkg.com/))

### Setup

0. Setup environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your providers SMTP and IMAP credentials. SMPT is used to send emails to users when they want to create an account or send transactions. IMAP is used to receive emails from users.

1. Start the local blockchain node and bundler:

   ```bash
   docker compose up
   ```

2. Open a new terminal and install contract dependencies and setup environment variables (the default values should work for most users):

   ```bash
   cd contracts && yarn && cp .env.example .env
   ```

## 🧪 Testing (Optional)

Run the smart contract tests:
```bash
npx hardhat test --network dev
```

## 📤 Send Transaction

You can send a transaction using the provided Hardhat task `esend-eth`.

1. Make sure you are in the `contracts` directory:

2. Run the `esend-eth` task with the user's email address and the transaction details as parameters - note this tool only supports sending ETH to an address, however the underlying Email Account contract supports any ERC-4337 `userOperation`:

   ```bash
   npx hardhat esend-eth --useremail user@example.com --amount 1 --to 0xRecipientEthereumAddress --network dev
   ```

Replace `user@example.com` with the actual email address of the user, `1` with the amount of ETH to send, and `0xRecipientEthereumAddress` with the actual recipient address.

This task will send a confirmation request to the user's email address. Once the user replies to the email, the transaction will be sent to the chain.

## 📧 Create New Email Account (Optional)

***If you want to test sending a transaction you don't need to create an email account first, an Email Account will be created automatically when you want to send the first transaction.***

You can create a new email account using the provided Hardhat task.

1. Make sure you are in the `contracts` directory:

2. Run the `create-eaccount` task with the user's email address as a parameter:

   ```bash
   npx hardhat create-eaccount --useremail user@example.com
   ```

Replace `user@example.com` with the actual email address of the user you want to create an account for.

This task will send a welcome email to the specified email address.


