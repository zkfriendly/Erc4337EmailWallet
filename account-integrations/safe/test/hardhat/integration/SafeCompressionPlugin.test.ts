import { expect } from "chai";
import { getBytes, resolveProperties, ethers } from "ethers";
import { UserOperationStruct } from "@account-abstraction/contracts";
import { getUserOpHash } from "@account-abstraction/utils";
import {
  AddressRegistry__factory,
  FallbackDecompressor__factory,
  SafeCompressionFactory__factory,
  SafeCompressionPlugin__factory,
  SafeProxyFactory__factory,
  Safe__factory,
} from "../../../typechain-types";
import sendUserOpAndWait from "../utils/sendUserOpAndWait";
import receiptOf from "../utils/receiptOf";
import SafeSingletonFactory from "../utils/SafeSingletonFactory";
import makeDevFaster from "../utils/makeDevFaster";

const ERC4337_TEST_ENV_VARIABLES_DEFINED =
  typeof process.env.ERC4337_TEST_BUNDLER_URL !== "undefined" &&
  typeof process.env.ERC4337_TEST_NODE_URL !== "undefined" &&
  typeof process.env.MNEMONIC !== "undefined";

const itif = ERC4337_TEST_ENV_VARIABLES_DEFINED ? it : it.skip;
const BUNDLER_URL = process.env.ERC4337_TEST_BUNDLER_URL;
const NODE_URL = process.env.ERC4337_TEST_NODE_URL;
const MNEMONIC = process.env.MNEMONIC;

describe("SafeCompressionPlugin", () => {
  const setupTests = async () => {
    const bundlerProvider = new ethers.JsonRpcProvider(BUNDLER_URL);
    const provider = new ethers.JsonRpcProvider(NODE_URL);
    await makeDevFaster(provider);

    const userWallet = ethers.Wallet.fromPhrase(MNEMONIC!).connect(provider);

    const entryPoints = (await bundlerProvider.send(
      "eth_supportedEntryPoints",
      [],
    )) as string[];

    if (entryPoints.length === 0) {
      throw new Error("No entry points found");
    }

    const ssf = await SafeSingletonFactory.init(userWallet);

    return {
      factory: await ssf.connectOrDeploy(SafeProxyFactory__factory, []),
      singleton: await ssf.connectOrDeploy(Safe__factory, []),
      bundlerProvider,
      provider,
      userWallet,
      entryPoints,
    };
  };

  /**
   * This test verifies a ERC4337 transaction succeeds when sent via a plugin
   * The user operation deploys a Safe with the ERC4337 plugin and a handler
   * and executes a transaction, thus verifying two things:
   * 1. Deployment of the Safe with the ERC4337 plugin and handler is possible
   * 2. Executing a transaction is possible
   */
  itif("should pass the ERC4337 validation", async () => {
    const { singleton, provider, bundlerProvider, userWallet, entryPoints } =
      await setupTests();

    const ENTRYPOINT_ADDRESS = entryPoints[0];

    const ssf = await SafeSingletonFactory.init(userWallet);

    const safeCompressionFactory = await ssf.connectOrDeploy(
      SafeCompressionFactory__factory,
      [],
    );

    const feeData = await provider.getFeeData();
    if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
      throw new Error(
        "maxFeePerGas or maxPriorityFeePerGas is null or undefined",
      );
    }

    const maxFeePerGas = `0x${feeData.maxFeePerGas.toString()}`;
    const maxPriorityFeePerGas = `0x${feeData.maxPriorityFeePerGas.toString()}`;

    const owner = ethers.Wallet.createRandom(provider);

    await receiptOf(
      userWallet.sendTransaction({
        to: owner.address,
        value: ethers.parseEther("100"),
      }),
    );

    const addressRegistry = await ssf.connectOrDeploy(
      AddressRegistry__factory,
      [],
    );

    const fallbackDecompressor = await ssf.connectOrDeploy(
      FallbackDecompressor__factory,
      [await addressRegistry.getAddress()],
    );

    const createArgs = [
      singleton,
      ENTRYPOINT_ADDRESS,
      await fallbackDecompressor.getAddress(),
      owner.address,
      0,
    ] satisfies Parameters<typeof safeCompressionFactory.create.staticCall>;

    const accountAddress = await safeCompressionFactory.create.staticCall(
      ...createArgs,
    );

    await receiptOf(safeCompressionFactory.create(...createArgs));

    const compressionAccount = SafeCompressionPlugin__factory.connect(
      accountAddress,
      userWallet,
    );

    const recipient = new ethers.Wallet(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    );

    const transferAmount = ethers.parseEther("1");

    const compressedActions = await fallbackDecompressor.compress(
      [
        {
          to: recipient.address,
          value: transferAmount,
          data: "0x",
        },
      ],
      [],
    );

    const userOpCallData = compressionAccount.interface.encodeFunctionData(
      "decompressAndPerform",
      [compressedActions],
    );

    // Native tokens for the pre-fund 💸
    await receiptOf(
      userWallet.sendTransaction({
        to: accountAddress,
        value: ethers.parseEther("100"),
        nonce: await userWallet.getNonce(),
      }),
    );

    const unsignedUserOperation: UserOperationStruct = {
      sender: accountAddress,
      nonce: "0x0",

      // Note: initCode is not used because we need to create both the safe
      // proxy and the plugin, and 4337 currently only allows one contract
      // creation in this step. Since we need an extra step anyway, it's simpler
      // to do the whole create outside of 4337.
      initCode: "0x",

      callData: userOpCallData,
      callGasLimit: "0x7A120",
      verificationGasLimit: "0x7A120",
      preVerificationGas: "0x186A0",
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: "0x",
      signature: "",
    };

    const resolvedUserOp = await resolveProperties(unsignedUserOperation);
    const userOpHash = getUserOpHash(
      resolvedUserOp,
      ENTRYPOINT_ADDRESS,
      Number((await provider.getNetwork()).chainId),
    );
    const userOpSignature = await owner.signMessage(getBytes(userOpHash));

    const userOperation = {
      ...unsignedUserOperation,
      signature: userOpSignature,
    };

    const recipientBalanceBefore = await provider.getBalance(recipient.address);

    await sendUserOpAndWait(userOperation, ENTRYPOINT_ADDRESS, bundlerProvider);

    const recipientBalanceAfter = await provider.getBalance(recipient.address);

    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;
    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});
