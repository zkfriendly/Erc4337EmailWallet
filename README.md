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

   Edit `.env` with your providers SMTP credentials. This is used to send emails to users when they want to create an account or send transactions.

1. Start the local blockchain node and bundler:

   ```bash
   docker compose up -d
   ```

2. Install contract dependencies and setup environment variables:

   ```bash
   cd contracts && yarn && cp .env.example .env
   ```

## 🧪 Testing (Optional)

Run the smart contract tests:
```bash
npx hardhat test --network dev
```

## 📧 Create New Email Account

You can create a new email account using the provided Hardhat task.

1. Make sure you are in the `contracts` directory:

2. Run the `create-eaccount` task with the user's email address as a parameter:

   ```bash
   npx hardhat create-eaccount --useremail user@example.com
   ```

Replace `user@example.com` with the actual email address of the user you want to create an account for.

This task will send a welcome email to the specified email address.

