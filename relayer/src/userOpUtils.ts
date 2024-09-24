import { BigNumberish, BytesLike, ethers } from "ethers";

type UserOperation = {
  sender: string;
  nonce: BigNumberish;
  callData: BytesLike;
  callGasLimit: BigNumberish;
  verificationGasLimit: BigNumberish;
  preVerificationGas: BigNumberish;
  maxFeePerGas: BigNumberish;
  maxPriorityFeePerGas: BigNumberish;
  signature: BytesLike;
};

export async function sendUserOpAndWait(
  userOp: UserOperation,
  pollingDelay = 100,
  maxAttempts = 200
) {

  const bundlerProvider = new ethers.JsonRpcProvider(process.env.BUNDLER_URL!);

  // get entry point bundler call 
  const entryPoints = await bundlerProvider.send("eth_supportedEntryPoints", []);

  if (entryPoints.length === 0) {
    throw new Error("No entry points found");
  }

  const entryPoint = entryPoints[0];

  const userOpHash = (await bundlerProvider.send("eth_sendUserOperation", [
    userOp,
    entryPoint,
  ])) as string;

  let receipt: any;

  let attempts = 0;

  while (attempts < maxAttempts && receipt === null) {
    await sleep(pollingDelay);

    receipt = (await bundlerProvider.send("eth_getUserOperationReceipt", [
      userOpHash,
    ]))

    attempts++;
  }

  if (receipt === null) {
    throw new Error(`Could not get receipt after ${maxAttempts} attempts`);
  }

  return receipt;
}

function sleep(pollingDelay: number) {
  return new Promise(resolve => setTimeout(resolve, pollingDelay));
}
