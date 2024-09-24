import { JsonRpcProvider, Signer } from "ethers";
import { createUserOperation } from "./userOpUtils";
import { eSign } from "./utils";

export async function generateUnsignedUserOp(
  provider: JsonRpcProvider,
  bundlerProvider: JsonRpcProvider,
  emailAccountAddress: string,
  callData: string,
  entryPointAddress: string,
  accountCommitment: string,
  domainPubKeyHash: string
) {
  const dummySignature = await eSign({
    userOpHashIn: "0x0",
    emailCommitmentIn: accountCommitment,
    pubkeyHashIn: domainPubKeyHash,
  });

  return await createUserOperation(
    provider,
    bundlerProvider,
    emailAccountAddress,
    { factory: "0x", factoryData: "0x" },
    callData,
    entryPointAddress,
    dummySignature // Temporary placeholder for signature
  );
}