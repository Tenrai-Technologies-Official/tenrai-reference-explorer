import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrivateTransferStatus } from "@tenrai/sdk";
import { privateTransfersUsable } from "@tenrai/sdk";

const inactive: PrivateTransferStatus = {
  api_version: 1,
  finalized_height: 12,
  active: false,
  protocol: {
    name: "TSP-2 Q1",
    verifier_keys_digest: "c2".repeat(48),
    circuits: [
      { circuit: "transfer", verifier_key_digest: "62".repeat(48) },
      { circuit: "enter-1", verifier_key_digest: "b7".repeat(48) },
      { circuit: "enter-2", verifier_key_digest: "65".repeat(48) },
      { circuit: "exit-1", verifier_key_digest: "55".repeat(48) },
      { circuit: "exit-2", verifier_key_digest: "22".repeat(48) },
    ],
    target_security_bits: 128,
    security_qualification: "incomplete",
    open_review_items: ["soundness of FRI on the lifted single domain"],
    verifier_work_units: 40_000,
    verifier_scratch_bytes: 33_554_432,
    largest_measured_proof_bytes: 1_050_255,
    fits_consensus_limits: false,
  },
  limits: { max_proof_bytes: 131_072, max_wire_bytes: 163_840, sources: 2, outputs: 2, statements_per_cut: 4, registrations_per_cut: 16 },
  fees: {
    multiplier: 10,
    burned_percent: 50,
    schedule_digest: null,
    minimum_fee_per_mass: null,
    minimum_note_value: null,
    transfer_fee: null,
    components: [],
  },
  capacity: { cut_interval_millis: 2_500, statements_per_minute: 96, recent_cuts: 0, recent_statements: 0, recent_registrations: 0 },
  notes: { appended: 0, capacity: "18446744073709551616", records: 0, confidential_atoms: "0" },
  pool: { statements: 0, registrations: 0, bytes: 0 },
};

test("private transfers are not usable while inactive or while the security review is open", () => {
  assert.equal(privateTransfersUsable(inactive), false);
  const active: PrivateTransferStatus = { ...inactive, active: true, protocol: { ...inactive.protocol, fits_consensus_limits: true } };
  assert.equal(privateTransfersUsable(active), false, "not usable while the security review is open");
});
