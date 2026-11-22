import { requireCompactFunding } from "./compact-funding.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { TenraiApiError, type CompactTransactionView, type TransactionView } from "@tenrai/sdk";
import { transactionHistory } from "./transaction-history.ts";

const id = "ab".repeat(48);
const compact = {
  transaction_id: id,
  kind: "payment", block_id: "ff".repeat(48), status: { transaction_id: id },
  provenance: "local_validation",
  recorded_witness_id: "cd".repeat(48),
  unsigned_body_hex: "00",
} as CompactTransactionView;

test("a typed retention gap uses an explicit compact result without fake canonical wire", async () => {
  let reads = 0;
  const result = await transactionHistory({
    get: async () => { throw new TenraiApiError(404, "not_found", "pruned", undefined, "history_not_held"); },
    compact: async () => { reads += 1; return compact; },
  }, id);
  assert.equal(reads, 1);
  assert.equal(result.retention, "compact");
  assert.equal("wire_hex" in result, false);
  assert.equal("witness_id" in result, false);
});

test("unknown or busy full lookups never become a compact success", async () => {
  for (const failure of [
    new TenraiApiError(404, "not_found", "unknown"),
    new TenraiApiError(503, "unavailable", "busy"),
  ]) {
    let reads = 0;
    await assert.rejects(transactionHistory({
      get: async () => { throw failure; },
      compact: async () => { reads += 1; return compact; },
    }, id), (error) => error === failure);
    assert.equal(reads, 0);
  }
});

test("a missing compact projection remains unavailable", async () => {
  const missing = new TenraiApiError(404, "not_found", "compact not held", undefined, "history_not_held");
  await assert.rejects(transactionHistory({
    get: async () => { throw new TenraiApiError(404, "not_found", "pruned", undefined, "history_not_held"); },
    compact: async () => { throw missing; },
  }, id), (error) => error === missing);
});

test("full canonical data retains its own result type", async () => {
  const full = { transaction_id: id, wire_hex: "01" } as TransactionView;
  const result = await transactionHistory({
    get: async () => full,
    compact: async () => { throw new Error("must not read compact history"); },
  }, id);
  assert.equal(result.retention, "full");
  assert.ok(result.retention === "full");
  assert.equal(result.wire_hex, "01");
});

test("funding display requires consistent finalized private placement and exact authorization IDs", () => {
  const value = { ...compact, kind: "private_register", block_id: null,
    operation: { type: "private_register", data: { authorization_id: "cd".repeat(48) } },
    private_funding: { kind: "registration", registration_id: "ef".repeat(48), authorization_id: "cd".repeat(48), owner_lock_hex: "01" + "42".repeat(40) },
    status: { transaction_id: id, lifecycle: "finalized", finalized_cut: { height: 8 }, observed_work: null, registered_cut: null },
  } as unknown as CompactTransactionView;
  assert.equal(requireCompactFunding(value), value);
  assert.throws(() => requireCompactFunding({ ...value, block_id: "ff".repeat(48) }));
  assert.throws(() => requireCompactFunding({ ...value, private_funding: undefined }));
  assert.throws(() => requireCompactFunding({ ...value, private_funding: { ...value.private_funding!, authorization_id: "aa".repeat(48) } } as CompactTransactionView));
  assert.throws(() => requireCompactFunding({ ...value, wire_hex: "00" } as CompactTransactionView));
});
