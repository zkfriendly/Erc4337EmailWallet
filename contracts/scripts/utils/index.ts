import { BigNumberish, BytesLike, ethers, JsonRpcProvider } from "ethers";
import * as snarkjs from "snarkjs";
import { createUserOperation, FactoryParams, UserOperation } from "../../test/userOpUtils";
import { IEntryPoint__factory } from "../../typechain";

export async function mockProver(input: any) {
  // Load the circuit
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    "test/prover/mock/main.wasm",
    "test/prover/mock/groth16_pkey.zkey"
  );

  let solidityCalldata = await snarkjs.groth16.exportSolidityCallData(
    proof,
    publicSignals
  );
  solidityCalldata = JSON.parse("[" + solidityCalldata + "]");
  return { proof, publicSignals, solidityCalldata };
}

export async function eSign(input: {
  userOpHashIn: string;
  emailCommitmentIn: string;
  pubkeyHashIn: string;
}) {
  const publicInputs = {
    userOpHashIn: input.userOpHashIn,
    emailCommitmentIn: input.emailCommitmentIn,
    pubkeyHashIn: input.pubkeyHashIn,
  };

  const { solidityCalldata } = await mockProver(publicInputs);

  const signature = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[3]"],
    solidityCalldata as any
  );

  return signature;
}

export async function generateUnsignedUserOp(
  entryPointAddress: string,
  provider: JsonRpcProvider,
  bundlerProvider: JsonRpcProvider,
  emailAccountAddress: string,
  callData: string
) {
  const dummySignature = await eSign({
    userOpHashIn: "0x0",
    emailCommitmentIn: "0x0",
    pubkeyHashIn: "0x0",
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