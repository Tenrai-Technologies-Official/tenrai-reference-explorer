import { addressLockProfile, type InputAuthorizationView, type InputView, type OutputView } from "@tenrai/sdk";

export type NativeAuthorization = Extract<InputAuthorizationView, { profile: "native_lock" }>;
export interface NativeConditions {
  type: "timelock" | "hashlock" | "htlc";
  owner?: string;
  claimOwner?: string;
  refundOwner?: string;
  hash?: string;
  unlockHeight?: string;
  refundHeight?: string;
}

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const HRPS = ["trai", "ttrai", "dtrai"];
export const NATIVE_FUNDING_NOTICE = "Native lock outputs carry a commitment only. The owner, hash and height conditions are revealed when an input spends them; a funding output alone does not identify the lock type.";
export const NATIVE_DISPLAY_NOTICE = "Conditions decoded from node-reported spend metadata. This display does not independently verify the descriptor commitment or signature. Heights are finalized cut heights, not wall-clock deadlines.";

function fail(): never { throw new TypeError("Native lock metadata is inconsistent or unsupported."); }
function canonicalHex(value: unknown, maximum: number): string {
  if (typeof value !== "string" || value.length > maximum || value.length % 2 !== 0 || !/^[0-9a-f]*$/.test(value)) fail();
  return value;
}
function polymod(values: readonly number[]): number {
  let check = 1;
  for (const value of values) {
    const top = check >>> 25;
    check = (((check & 0x1ffffff) << 5) ^ value) >>> 0;
    for (let bit = 0; bit < 5; bit += 1) if ((top >>> bit) & 1) check = (check ^ (GENERATORS[bit] ?? 0)) >>> 0;
  }
  return check;
}
/** Format the SDK's version-1 payload as Bech32m. */
function addressForLock(lock: string, hrp: string): string {
  if (!HRPS.includes(hrp) || canonicalHex(lock, 82).length !== 82) fail();
  const bytes = [1, ...Array.from({ length: 41 }, (_, index) => Number.parseInt(lock.slice(index * 2, index * 2 + 2), 16))];
  const symbols: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) { bits -= 5; symbols.push((buffer >>> bits) & 31); }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) symbols.push((buffer << (5 - bits)) & 31);
  const codes = [...hrp].map((char) => char.charCodeAt(0));
  const expanded = [...codes.map((code) => code >>> 5), 0, ...codes.map((code) => code & 31)];
  const check = (polymod([...expanded, ...symbols, 0, 0, 0, 0, 0, 0]) ^ 0x2bc830a3) >>> 0;
  const checksum = Array.from({ length: 6 }, (_, index) => (check >>> (5 * (5 - index))) & 31);
  return hrp + "1" + [...symbols, ...checksum].map((value) => CHARSET[value]).join("");
}

/** Decode the bounded descriptor for display. Cryptographic verification belongs to the protocol. */
export function decodeNativeConditions(descriptor: unknown, hrp: string): NativeConditions {
  const hex = canonicalHex(descriptor, 248);
  if (hex.slice(0, 2) !== "01") fail();
  const opcode = hex.slice(2, 4);
  if (!((opcode === "01" && hex.length === 102) || (opcode === "02" && hex.length === 150) || (opcode === "03" && hex.length === 248))) fail();
  const owner = (offset: number) => {
    const lock = hex.slice(offset * 2, (offset + 41) * 2);
    if (!lock.startsWith("01")) fail();
    return addressForLock(lock, hrp);
  };
  const height = (offset: number) => {
    const value = BigInt("0x" + hex.slice(offset * 2, (offset + 8) * 2));
    if (value === 0n) fail();
    return value.toString();
  };
  if (opcode === "01") return { type: "timelock", owner: owner(2), unlockHeight: height(43) };
  if (opcode === "02") return { type: "hashlock", owner: owner(2), hash: hex.slice(86, 150) };
  return { type: "htlc", claimOwner: owner(2), refundOwner: owner(43), hash: hex.slice(168, 232), refundHeight: height(116) };
}

export function nativeAuthorizationConditions(authorization: NativeAuthorization, inputs: readonly InputView[]): NativeConditions {
  if (!Number.isSafeInteger(authorization.input_index) || authorization.input_index < 0 || authorization.input_index >= inputs.length || authorization.signature_count !== 1) fail();
  const commitment = canonicalHex(authorization.lock_commitment, 80);
  if (commitment.length !== 80) fail();
  const spent = inputs[authorization.input_index]?.spends;
  if (!spent || spent.lock !== "03" + commitment || addressLockProfile(spent.address) !== "native_lock") fail();
  const hrp = spent.address.slice(0, spent.address.lastIndexOf("1"));
  if (addressForLock(spent.lock, hrp) !== spent.address) fail();
  const details = decodeNativeConditions(authorization.descriptor_hex, hrp);
  const preimage = canonicalHex(authorization.preimage_hex, 128);
  if (details.type !== authorization.lock_type || (authorization.branch !== "claim" && authorization.branch !== "refund")) fail();
  if (details.type !== "htlc" && authorization.branch !== "claim") fail();
  if (details.type === "timelock" || authorization.branch === "refund") { if (preimage.length !== 0) fail(); }
  else if (details.type === "htlc" ? preimage.length !== 64 : preimage.length === 0) fail();
  return details;
}

export function hasNativeFundingOutput(outputs: readonly OutputView[]): boolean {
  return outputs.some((output) => {
    try {
      const hrp = output.address.slice(0, output.address.lastIndexOf("1"));
      return output.lock.startsWith("03") && addressLockProfile(output.address) === "native_lock" && addressForLock(output.lock, hrp) === output.address;
    } catch { return false; }
  });
}
