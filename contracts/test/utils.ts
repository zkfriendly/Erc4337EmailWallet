import { BigNumberish, BytesLike, ethers } from "ethers";
import * as snarkjs from "snarkjs";
import { FactoryParams, UserOperation } from "./userOpUtils";
import { IEntryPoint__factory } from "../typechain-types";

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
