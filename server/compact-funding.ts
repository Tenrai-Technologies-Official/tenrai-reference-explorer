import type { CompactTransactionView } from "@tenrai/sdk";

const HASH = /^[0-9a-f]{96}$/;

/** Local display provenance remains distinct from canonical signatures and finality proofs. */
export function requireCompactFunding(value: CompactTransactionView): CompactTransactionView {
  if ("wire_hex" in value || "witness_id" in value || "authorizations" in value) throw new TypeError("Compact display data claims canonical witnesses.");
  if (value.provenance !== "local_validation" || value.status.transaction_id !== value.transaction_id) throw new TypeError("Invalid compact transaction provenance or identity.");
  const funding = value.private_funding;
  const privateKind = value.kind === "private_enter" || value.kind === "private_register";
  if (!funding) {
    if (privateKind || typeof value.block_id !== "string" || !HASH.test(value.block_id)) throw new TypeError("Missing compact private funding metadata.");
    return value;
  }
  if (!privateKind || value.block_id !== null || value.status.lifecycle !== "finalized" || !value.status.finalized_cut
      || value.status.observed_work || value.status.registered_cut) throw new TypeError("Invalid compact private funding placement.");
  const operation = value.operation;
  if (funding.kind === "enter") {
    if (value.kind !== "private_enter" || operation?.type !== "private_enter" || !HASH.test(funding.statement_id)
        || operation.data.statement_digest !== funding.statement_id) throw new TypeError("Invalid compact ENTER identity.");
  } else if (funding.kind === "registration") {
    if (value.kind !== "private_register" || operation?.type !== "private_register" || !HASH.test(funding.registration_id)
        || !HASH.test(funding.authorization_id) || operation.data.authorization_id !== funding.authorization_id
        || !/^01[0-9a-f]{80}$/.test(funding.owner_lock_hex)) throw new TypeError("Invalid compact registration identity.");
  } else throw new TypeError("Unknown compact private funding kind.");
  return value;
}
