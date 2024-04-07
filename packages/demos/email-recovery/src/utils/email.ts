import { buildPoseidon, Poseidon } from "circomlibjs";

// From https://github.com/zkemail/email-wallet/blob/main/packages/frontend/src/components/RegisterUnclaim.tsx
function padStringToBytes(str: string, len: number): Uint8Array {
    const bytes = new Uint8Array(len);
    const strBytes = (new TextEncoder).encode(str);
    bytes.set(strBytes);
    const empty = new Uint8Array(len - strBytes.length);
    bytes.set(empty, strBytes.length);
    return bytes;
}

function bytes2fields(bytes: Uint8Array, F: Poseidon['F']): bigint[] {
    const fields: bigint[] = [];
    for (let i = 0; i < bytes.length; i += 31) {
        const bytes32 = new Uint8Array(32);
        bytes32.set(bytes.slice(i, i + 31));
        const val = F.fromRprLE(bytes32, 0);
        fields.push(val);
    }
    return fields;
}

export function bytesToHex(bytes: Uint8Array) {
    return [...bytes]
        .reverse()
        .map(x => x.toString(16).padStart(2, "0"))
        .join("");
}

export async function genAccountCode(): Promise<string> {
    const poseidon = await buildPoseidon();
    const accountCodeBytes: Uint8Array = poseidon.F.random();
    return bytesToHex(accountCodeBytes);
}

export async function getGuardianAddress(guardianEmail: string, accountCode: string) {
    const poseidon = await buildPoseidon();
    const emailField = bytes2fields(padStringToBytes(guardianEmail, 256), poseidon.F);
    const guardianAddressBytes = poseidon([
        ...emailField, accountCode, 0
    ]);
    const guardianAddress: `0x${string}` = `0x${bytesToHex(guardianAddressBytes)}`
    return guardianAddress;
}

// TODO Update both with safe module accept subject
export const getRequestGuardianSubject = (acctAddr: string) => `Accept guardian request for ${acctAddr}`;
export const getRequestsRecoverySubject = (acctAddr: string, newOwner: string) => `Set the new signer of ${acctAddr} to ${newOwner}`;
