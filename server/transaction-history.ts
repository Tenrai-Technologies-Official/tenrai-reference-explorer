import { requireCompactFunding } from "./compact-funding.ts";
import { TenraiApiError, type TenraiClient } from "@tenrai/sdk";
import type { TransactionHistoryRecord } from "../shared/api.ts";

type Transactions = Pick<TenraiClient["transactions"], "get" | "compact">;

/** Distinguish compact records from canonical transaction wire. */
export async function transactionHistory(
  transactions: Transactions,
  id: string,
): Promise<TransactionHistoryRecord> {
  try {
    const full = await transactions.get(id);
    return { ...full, retention: "full" };
  } catch (error) {
    if (!(error instanceof TenraiApiError) || error.status !== 404 || error.reason !== "history_not_held") {
      throw error;
    }
    const compact = requireCompactFunding(await transactions.compact(id));
    return { ...compact, retention: "compact" };
  }
}
