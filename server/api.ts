import { TenraiApiError, type BlockView, type CutChanges, type TenraiClient } from "@tenrai/sdk";
import { isMessengerPayload, isSafeText, recipientPayloads } from "@tenrai/sdk/wallet";
import { Router } from "express";
import {
  LIVE_BLOCKS,
  OVERVIEW_ROWS,
  PAGE_ROWS,
  type AddressPage,
  type UnconfirmedPayment,
  type BlockPage,
  type CutPage,
  type MempoolPage,
  type Overview,
  type PaidIn,
  type RecentBlocks,
  type RecentTransactions,
  type SearchResult,
  type Status,
  type TransactionPage,
  type ValidatorPage,
} from "../shared/api.ts";
import type { LiveCuts } from "./live.ts";
import { transactionHistory } from "./transaction-history.ts";
import { shared, sharedBy } from "./shared.ts";
import { stakedPrincipal } from "./staked-principal.ts";
import { workLimit } from "./work-limit.ts";
import type { RequestHandler } from "express";
import type { RouteParameters } from "express-serve-static-core";

const PAGE = PAGE_ROWS;
// The node retains 500 recent work blocks and transactions.
const RECENT_PAGES = 10;
const CHANGES = 4_096;
const PAYOUT_SEARCH = 16;
const STAKING_REFRESH_MILLIS = 5_000;
const HEIGHT = /^\d{1,15}$/;
const ID = /^[0-9a-f]{96}$/;
const ADDRESS = /^[a-z0-9]{8,128}$/;
const utf8 = new TextDecoder("utf-8", { fatal: true });

export function explorerApi(tenrai: TenraiClient, live: LiveCuts): Router {
  const api = Router();
  const limitWork = workLimit();
  const read = <Route extends string>(path: Route, handler: RequestHandler<RouteParameters<Route>>) => api.get(path, limitWork(handler));

  const status = shared(1_000, async (): Promise<Status> => {
    const [node, sync] = await Promise.all([tenrai.node.info(), tenrai.node.sync().catch(() => null)]);
    return {
      network: node.network,
      height: node.finalized.height,
      nodeVersion: node.node_version,
      sync: sync && { synced: sync.synced, behindBy: sync.behind_by, peers: sync.peers },
    };
  });

  const overview = shared(1_000, async (): Promise<Overview> => {
    const [node, rates, mempool, epoch, supply, cuts, blocks, transactions] = await Promise.all([
      tenrai.node.info(),
      tenrai.chain.rates(),
      tenrai.mempool.info(),
      tenrai.chain.epoch(),
      tenrai.economics.supply(),
      tenrai.cuts.list({ limit: OVERVIEW_ROWS }),
      tenrai.blocks.recent({ limit: LIVE_BLOCKS }),
      tenrai.transactions.recent({ limit: OVERVIEW_ROWS }),
    ]);
    return {
      node,
      rates,
      mempool,
      epoch,
      supply,
      cuts: cuts.cuts,
      blocks: blocks.blocks,
      transactions: transactions.transactions,
    };
  });

  const mempool = shared(1_000, async (): Promise<MempoolPage> => {
    const [info, fees, pool] = await Promise.all([
      tenrai.mempool.info(),
      tenrai.fees.estimate(),
      tenrai.mempool.transactions({ limit: 100 }),
    ]);
    return { info, fees, pool };
  });

  const validators = shared(STAKING_REFRESH_MILLIS, () => tenrai.staking.validators({ limit: PAGE }));
  const validator = sharedBy(STAKING_REFRESH_MILLIS, 128, (id: string) => tenrai.staking.validator(id));
  const validatorSlash = sharedBy(STAKING_REFRESH_MILLIS, 128, (id: string) => tenrai.staking.validatorSlash(id));
  const validatorPositions = sharedBy(STAKING_REFRESH_MILLIS, 128, (id: string) => tenrai.staking.validatorPositions(id, { limit: PAGE }));

  const blockPages = Array.from({ length: RECENT_PAGES }, (_, index) =>
    shared(1_000, () => tenrai.blocks.recent({ limit: (index + 1) * PAGE })),
  );
  let intervalCuts: number | null = null;

  // Cache the fixed emission interval after the first successful read.
  const accountingInterval = async (): Promise<number | null> => {
    intervalCuts ??= await tenrai.economics
      .emission()
      .then((emission) => emission.reduction_interval_cuts)
      .catch(() => null);
    return intervalCuts;
  };
  const transactionPages = Array.from({ length: RECENT_PAGES }, (_, index) =>
    shared(1_000, () => tenrai.transactions.recent({ limit: (index + 1) * PAGE })),
  );

  read("/status", async (_req, res) => {
    res.json(await status());
  });

  read("/overview", async (_req, res) => {
    res.json(await overview());
  });

  api.get("/live", (req, res) => live.follow(req, res));

  read("/cuts", async (req, res) => {
    const before = text(req.query.before);
    res.json(await tenrai.cuts.list({ before: before === undefined ? undefined : Number(before), limit: 25 }));
  });

  read("/cuts/:height", async (req, res) => {
    const height = Number(req.params.height);
    const [cut, transactions, changes, intervalCuts, privateItems] = await Promise.all([
      tenrai.cuts.get(height),
      tenrai.cuts.transactions(height, { limit: PAGE }),
      tenrai.cuts.changes(height, { limit: CHANGES }).catch(() => null),
      accountingInterval(),
      tenrai.privateTransfers.cutItems(height).catch(() => null),
    ]);
    res.json({ cut, transactions, paidTo: paidTo(changes), payoutFrom: payoutFrom(height, intervalCuts), privateItems } satisfies CutPage);
  });

  read("/cuts/:height/transactions", async (req, res) => {
    const height = Number(req.params.height);
    res.json(await tenrai.cuts.transactions(height, { cursor: text(req.query.cursor), limit: PAGE }));
  });

  read("/blocks", async (req, res) => {
    const page = recentPage(req.query.page);
    if (page === 1) {
      const { blocks } = await blockPages[LIVE_BLOCKS / PAGE - 1]!();
      res.json({ blocks, page, older: blocks.length > PAGE } satisfies RecentBlocks);
      return;
    }
    const { blocks } = await blockPages[page - 1]!();
    res.json({ blocks: blocks.slice((page - 1) * PAGE), page, older: hasOlder(blocks.length, page) } satisfies RecentBlocks);
  });

  read("/blocks/:id", async (req, res) => {
    const block = await tenrai.blocks.get(req.params.id);
    res.json({ block, paidIn: await paidIn(tenrai, block) } satisfies BlockPage);
  });

  read("/transactions", async (req, res) => {
    const page = recentPage(req.query.page);
    const { transactions } = await transactionPages[page - 1]!();
    res.json({
      transactions: transactions.slice((page - 1) * PAGE),
      page,
      older: hasOlder(transactions.length, page),
    } satisfies RecentTransactions);
  });

  read("/transactions/:id", async (req, res) => {
    const view = await transactionHistory(tenrai.transactions, req.params.id);
    const messenger = isMessengerPayload(view.payload_hex);
    const perRecipient = messenger ? null : recipientPayloads(view.payload_hex);
    res.json({
      ...view,
      messenger,
      payload_text: messenger ? null : payloadText(view.payload_hex),
      recipient_payloads: perRecipient && perRecipient.map(({ output, payloadHex, text }) => ({ output, payload_hex: payloadHex, text })),
    } satisfies TransactionPage);
  });

  read("/private/active", async (_req, res) => {
    const status = await tenrai.privateTransfers.status().catch(() => null);
    res.json({ active: status?.active ?? false });
  });

  read("/private/statements", async (req, res) => {
    const before = text(req.query.before);
    res.json(await tenrai.privateTransfers.statements({ before: before === undefined ? undefined : Number(before), limit: 25 }));
  });

  read("/private/statements/:digest", async (req, res) => {
    res.json(await tenrai.privateTransfers.statement(req.params.digest));
  });

  read("/mempool", async (_req, res) => {
    res.json(await mempool());
  });

  read("/validators", async (req, res) => {
    const cursor = text(req.query.cursor);
    res.json(cursor === undefined ? await validators() : await tenrai.staking.validators({ cursor, limit: PAGE }));
  });

  read("/validators/:id/positions", async (req, res) => {
    const cursor = text(req.query.cursor);
    res.json(cursor === undefined ? await validatorPositions(req.params.id) : await tenrai.staking.validatorPositions(req.params.id, { cursor, limit: PAGE }));
  });

  read("/validators/:id", async (req, res) => {
    const id = req.params.id;
    const [detail, positions, slash] = await Promise.all([validator(id), validatorPositions(id), validatorSlash(id)]);
    res.json({ detail, positions, slash } satisfies ValidatorPage);
  });

  read("/address/:address", async (req, res) => {
    const { address } = req.params;
    const cursor = text(req.query.cursor);
    const [balance, history, unconfirmed, staked] = await Promise.all([
      tenrai.address.balance(address),
      tenrai.address.history(address, { cursor, limit: PAGE }),
      cursor === undefined ? unconfirmedPayments(tenrai, address) : [],
      cursor === undefined ? stakedPrincipal(tenrai.staking, address) : null,
    ]);
    res.json({ balance, history, unconfirmed, staked } satisfies AddressPage);
  });

  read("/search", async (req, res) => {
    const path = await search(tenrai, text(req.query.q) ?? "");
    if (path === undefined) {
      res.status(404).json({ api_version: 1, code: "not_found", message: "nothing on this chain matches", retry_after_millis: null });
      return;
    }
    res.json({ path } satisfies SearchResult);
  });

  api.use((_req, res) => {
    res.status(404).json({ api_version: 1, code: "not_found", message: "no such route", retry_after_millis: null });
  });

  return api;
}

async function search(tenrai: TenraiClient, query: string): Promise<string | undefined> {
  const wanted = query.trim().toLowerCase();
  if (HEIGHT.test(wanted)) {
    return `/cuts/${Number(wanted)}`;
  }
  if (ID.test(wanted)) {
    let historyGap: TenraiApiError | undefined;
    const rememberGap = (error: TenraiApiError) => { historyGap = error; };
    const [transaction, block, validator, statement] = await Promise.all([
      exists(tenrai.transactions.status(wanted).catch((error: unknown) => {
        if (error instanceof TenraiApiError && error.status === 404 && error.reason === "history_not_held") {
          return tenrai.transactions.compact(wanted);
        }
        throw error;
      }), rememberGap),
      exists(tenrai.blocks.get(wanted), rememberGap),
      exists(tenrai.staking.validator(wanted), rememberGap),
      exists(tenrai.privateTransfers.statement(wanted), rememberGap),
    ]);
    if (transaction) {
      return `/transactions/${wanted}`;
    }
    if (block) {
      return `/blocks/${wanted}`;
    }
    if (statement) {
      return `/private/${wanted}`;
    }
    if (validator) return `/validators/${wanted}`;
    if (historyGap) throw historyGap;
    return undefined;
  }
  if (ADDRESS.test(wanted) && (await exists(tenrai.address.balance(wanted)))) {
    return `/address/${wanted}`;
  }
  return undefined;
}

async function exists(lookup: Promise<unknown>, onHistoryGap?: (error: TenraiApiError) => void): Promise<boolean> {
  try {
    await lookup;
    return true;
  } catch (error) {
    if (error instanceof TenraiApiError && (error.code === "not_found" || error.code === "invalid_request")) {
      if (error.reason === "history_not_held") onHistoryGap?.(error);
      return false;
    }
    throw error;
  }
}

/** Use the wallet's UTF-8 display rules for transaction payloads. */
function payloadText(hex: string | null): string | null {
  if (!hex) {
    return null;
  }
  try {
    const decoded = utf8.decode(Buffer.from(hex, "hex"));
    return isSafeText(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function recentPage(value: unknown): number {
  const page = Number(text(value));
  return Number.isInteger(page) && page >= 1 && page <= RECENT_PAGES ? page : 1;
}

function hasOlder(loaded: number, page: number): boolean {
  return loaded === page * PAGE && page < RECENT_PAGES;
}

function paidTo(changes: CutChanges | null): Record<string, string> {
  const owners: Record<string, string> = {};
  for (const change of changes?.changes ?? []) {
    if (change.kind === "received" && (change.source === "work_reward" || change.source === "stake_reward")) {
      owners[`${change.outpoint.transaction_id}:${change.outpoint.output_index}`] = change.address;
    }
  }
  return owners;
}

/** The cut after the interval closes pays its stake rewards. */
function payoutFrom(height: number, intervalCuts: number | null): number | null {
  if (intervalCuts === null || intervalCuts === 0 || height === 0) {
    return null;
  }
  return (Math.floor((height - 1) / intervalCuts) + 1) * intervalCuts + 1;
}

/** Capped block rewards can settle several cuts after their first payable height. */
async function paidIn(tenrai: TenraiClient, block: BlockView): Promise<PaidIn | string | null> {
  if (block.reward?.state !== "paid") {
    return null;
  }
  const from = block.reward.payable_from_height;
  if (from === null) {
    return "Not retained";
  }
  for (let height = from; height < from + PAYOUT_SEARCH; height += 1) {
    const cut = await tenrai.cuts.get(height).catch(() => null);
    if (cut === null) {
      return "Unavailable";
    }
    if (cut.rewards === null) {
      return "Not retained";
    }
    const paid = cut.rewards.find((reward) => reward.block_id === block.block_id);
    if (paid) {
      return { height, amount: paid.amount, stakeRewards: cut.stake_rewards };
    }
  }
  return "Not found";
}

/** Use the mempool stage when upstream status is unavailable. */
async function unconfirmedPayments(tenrai: TenraiClient, address: string): Promise<UnconfirmedPayment[]> {
  const pending = await tenrai.mempool.pending([address]).catch(() => null);
  const entries = pending?.entries.filter((entry) => entry.address === address) ?? [];
  if (entries.length === 0) {
    return [];
  }
  const batch = await tenrai.transactions.statuses(entries.map((entry) => entry.transaction_id)).catch(() => null);
  const stages = new Map((batch?.statuses ?? []).map((status) => [status.transaction_id, status.lifecycle]));
  return entries.map((entry) => ({
    transaction_id: entry.transaction_id,
    amount: entry.outputs.reduce((sum, output) => sum + BigInt(output.amount), 0n).toString(),
    lifecycle: stages.get(entry.transaction_id) ?? "processing",
  }));
}
