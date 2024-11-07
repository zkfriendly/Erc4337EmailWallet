const relayerUtils = require("@zk-email/relayer-utils");

export async function emailAuth(
  emailRaw: string,
  accountCode: string,
  options?: {
    shaPrecomputeSelector?: string;
    maxHeaderLength?: number;
    maxBodyLength?: number;
    ignoreBodyHashCheck?: boolean;
  }
): Promise<{
  padded_header: string[];
  public_key: string[];
  signature: string[];
  padded_header_len: string;
  account_code: string;
  from_addr_idx: number;
  subject_idx: number;
  domain_idx: number;
  timestamp_idx: number;
  code_idx: number;
  body_hash_idx: number;
  precomputed_sha: string[];
  padded_body: string[];
  padded_body_len: string;
  command_idx: number;
  padded_cleaned_body: string[];
}> {
  const jsonStr = await relayerUtils.genEmailCircuitInput(
    emailRaw,
    accountCode,
    options
  );
  return JSON.parse(jsonStr);
}