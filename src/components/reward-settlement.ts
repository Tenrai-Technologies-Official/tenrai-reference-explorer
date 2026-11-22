import { createElement as h } from "react";

/** Settlement receipts include zero and burned claims without created outputs. */
export function RewardSettlementNotice() {
  return h("p", { className: "notice" }, "Reward totals include burned amounts. Burned and zero-value rewards do not add spendable coins to a wallet.");
}
