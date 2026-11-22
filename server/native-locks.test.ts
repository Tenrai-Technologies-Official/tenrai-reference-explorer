import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { InputView } from "@tenrai/sdk";
import { decodeNativeConditions, hasNativeFundingOutput, nativeAuthorizationConditions, NATIVE_DISPLAY_NOTICE, NATIVE_FUNDING_NOTICE, type NativeAuthorization } from "../shared/native-locks.ts";
import { NativeLockAuthorizationFacts } from "../src/components/native-lock-authorization.ts";

interface Vector { name: string; descriptor_hex: string; address: string; lock_hex: string; request: { type: "timelock" | "hashlock" | "htlc"; owner_address?: string; claim_address?: string; refund_address?: string; hash_hex?: string; unlock_height?: string; refund_height?: string }; branch: "claim" | "refund"; preimage_hex: string }
const vectors = JSON.parse(readFileSync(new URL("./fixtures/native-lock-conditions-v1.json", import.meta.url), "utf8")) as Vector[];
function authorization(vector: Vector): NativeAuthorization {
  return { profile: "native_lock", input_index: 0, signature_count: 1, lock_commitment: vector.lock_hex.slice(2), lock_type: vector.request.type, branch: vector.branch, descriptor_hex: vector.descriptor_hex, preimage_hex: vector.preimage_hex };
}
function inputs(vector: Vector): InputView[] {
  return [{ transaction_id: "07".repeat(48), output_index: 0, spends: { address: vector.address, lock: vector.lock_hex, amount: "1000000", source: "regular", created_finalized_height: 0, block_id: null } }];
}

test("native descriptors decode actual Rust owner addresses, hashes and heights without numeric narrowing", () => {
  for (const vector of vectors) {
    const result = nativeAuthorizationConditions(authorization(vector), inputs(vector));
    assert.equal(result.type, vector.request.type);
    assert.equal(result.owner, vector.request.owner_address);
    assert.equal(result.claimOwner, vector.request.claim_address);
    assert.equal(result.refundOwner, vector.request.refund_address);
    assert.equal(result.hash, vector.request.hash_hex);
    assert.equal(result.unlockHeight, vector.request.unlock_height);
    assert.equal(result.refundHeight, vector.request.refund_height);
    for (const hrp of ["trai", "ttrai", "dtrai"]) assert.ok((decodeNativeConditions(vector.descriptor_hex, hrp).owner ?? decodeNativeConditions(vector.descriptor_hex, hrp).claimOwner)?.startsWith(hrp + "1"));
  }
  const time = vectors[0]!;
  assert.equal(decodeNativeConditions(time.descriptor_hex.slice(0, -16) + "ffffffffffffffff", "ttrai").unlockHeight, "18446744073709551615");
  assert.equal(decodeNativeConditions(time.descriptor_hex.slice(0, -16) + "0020000000000001", "ttrai").unlockHeight, "9007199254740993");
});

test("native display decoder rejects noncanonical versions, lengths, owners and zero heights", () => {
  for (const vector of vectors) {
    for (const descriptor of ["", "01", vector.descriptor_hex + "00", vector.descriptor_hex.slice(0, -2), "02" + vector.descriptor_hex.slice(2), "0104" + vector.descriptor_hex.slice(4), vector.descriptor_hex.toUpperCase(), vector.descriptor_hex.slice(0, 4) + "02" + vector.descriptor_hex.slice(6), "gg", "00".repeat(125)]) assert.throws(() => decodeNativeConditions(descriptor, "ttrai"));
    assert.throws(() => decodeNativeConditions(vector.descriptor_hex, "other"));
    if (vector.request.type !== "hashlock") assert.throws(() => decodeNativeConditions(vector.descriptor_hex.slice(0, -16) + "0".repeat(16), "ttrai"));
    if (vector.request.type === "htlc") assert.throws(() => decodeNativeConditions(vector.descriptor_hex.slice(0, 86) + "03" + vector.descriptor_hex.slice(88), "ttrai"));
  }
});

test("native authorization display fails closed on inconsistent input, commitment, type and branch metadata", () => {
  for (const vector of vectors) {
    const auth = authorization(vector);
    for (const patch of [{ input_index: -1 }, { input_index: 1 }, { input_index: 0.5 }, { signature_count: 2 }, { lock_commitment: "ab".repeat(40) }, { lock_commitment: "00" }, { lock_type: "other" }, { branch: "other" }, { preimage_hex: "G0" }]) assert.throws(() => nativeAuthorizationConditions({ ...auth, ...patch } as NativeAuthorization, inputs(vector)));
    assert.throws(() => nativeAuthorizationConditions(auth, [{ ...inputs(vector)[0]!, spends: null }]));
    const wrongAddress = inputs(vector); wrongAddress[0]!.spends!.address = vectors.find((other) => other.address !== vector.address)!.address;
    assert.throws(() => nativeAuthorizationConditions(auth, wrongAddress));
    if (vector.request.type !== "htlc") assert.throws(() => nativeAuthorizationConditions({ ...auth, branch: "refund" }, inputs(vector)));
    if (vector.request.type === "timelock" || vector.branch === "refund") assert.throws(() => nativeAuthorizationConditions({ ...auth, preimage_hex: "ab" }, inputs(vector)));
    else {
      assert.throws(() => nativeAuthorizationConditions({ ...auth, preimage_hex: "" }, inputs(vector)));
      assert.throws(() => nativeAuthorizationConditions({ ...auth, preimage_hex: "ab".repeat(65) }, inputs(vector)));
      if (vector.request.type === "htlc") for (const length of [1, 31, 33, 64]) assert.throws(() => nativeAuthorizationConditions({ ...auth, preimage_hex: "ab".repeat(length) }, inputs(vector)));
    }
  }
});

test("real React native authorization view renders conditions, linked owners and raw recovery data", () => {
  for (const vector of vectors) {
    const html = renderToStaticMarkup(createElement(NativeLockAuthorizationFacts, { authorization: authorization(vector), inputs: inputs(vector) }));
    assert.ok(html.includes(`${vector.request.type}, ${vector.branch}`));
    assert.ok(html.includes(vector.descriptor_hex));
    for (const address of [vector.request.owner_address, vector.request.claim_address, vector.request.refund_address].filter((value): value is string => value !== undefined)) assert.ok(html.includes(`href="/address/${address}"`));
    for (const value of [vector.request.hash_hex, vector.request.unlock_height, vector.request.refund_height, vector.preimage_hex].filter(Boolean)) assert.ok(html.includes(value!));
    if (vector.request.type === "htlc") { assert.match(html, /Claim before finalized cut height/); assert.match(html, /Refund from finalized cut height/); }
    const invalid = renderToStaticMarkup(createElement(NativeLockAuthorizationFacts, { authorization: { ...authorization(vector), descriptor_hex: "invalid" }, inputs: inputs(vector) }));
    assert.match(invalid, /inconsistent or unsupported/);
    assert.ok(!invalid.includes("Claim owner") && !invalid.includes("Owner address"));
  }
});

test("funding output disclosure is separate from spend conditions and contains no clock countdown", () => {
  const vector = vectors[0]!;
  assert.equal(hasNativeFundingOutput([{ index: 0, amount: "1", address: vector.address, lock: vector.lock_hex }]), true);
  assert.equal(hasNativeFundingOutput([{ index: 0, amount: "1", address: vector.request.owner_address!, lock: vector.descriptor_hex.slice(4, 86) }]), false);
  assert.match(NATIVE_FUNDING_NOTICE, /commitment only/);
  assert.match(NATIVE_FUNDING_NOTICE, /revealed when an input spends/);
  assert.match(NATIVE_DISPLAY_NOTICE, /does not independently verify/);
  assert.match(NATIVE_DISPLAY_NOTICE, /finalized cut heights/);
});
