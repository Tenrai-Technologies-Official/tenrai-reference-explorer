import type { BlockSummary, CutSummary, InputView, TransactionSummary } from "@tenrai/sdk";
import { useState } from "react";
import { useDrip } from "../drip.ts";
import { count, cutRewards, source } from "../format.ts";
import { type Column, Steady, Table } from "./table.tsx";
import { AddressLink, Ago, Amount, CutLink, Hash, Lifecycle } from "./values.tsx";

/** Rewards and genesis outputs have no creating transaction. */
export const INPUT_COLUMNS: Column<InputView>[] = [
  {
    label: "Spends",
    cell: (row) => (
      <>
        <Hash
          id={row.transaction_id}
          to={row.spends === null || row.spends.source === "regular" ? `/transactions/${row.transaction_id}` : undefined}
        />
        :{row.output_index}
      </>
    ),
  },
  { label: "From", cell: (row) => (row.spends ? <AddressLink address={row.spends.address} /> : "–") },
  { label: "Amount", cell: (row) => <Amount atoms={row.spends?.amount ?? null} /> },
  { label: "Origin", cell: (row) => (row.spends ? source(row.spends.source) : "–") },
];

const CUT_COLUMNS: Column<CutSummary>[] = [
  { label: "Height", cell: (row) => <CutLink height={row.cut.height} /> },
  { label: "Cut", cell: (row) => <Hash id={row.cut.cut_id} /> },
  { label: "Registered", cell: (row) => count(row.registered_blocks) },
  { label: "Executed", cell: (row) => count(row.executed_blocks) },
  { label: "Rewards", cell: (row) => <Amount atoms={cutRewards(row.rewards, row.stake_rewards)} /> },
  { label: "Finalized", cell: (row) => <Ago millis={row.finalized_at_millis} /> },
];

const BLOCK_COLUMNS: Column<BlockSummary>[] = [
  { label: "Block", cell: (row) => <Hash id={row.block_id} to={`/blocks/${row.block_id}`} /> },
  { label: "Transactions", cell: (row) => count(row.transactions) },
  { label: "Miner", cell: (row) => row.miner_tag ?? "–" },
  { label: "Reward to", cell: (row) => <AddressLink address={row.reward_address} /> },
  { label: "Seen", cell: (row) => <Ago millis={row.seen_at_millis} /> },
];

const TRANSACTION_COLUMNS: Column<TransactionSummary>[] = [
  { label: "Transaction", cell: (row) => <Hash id={row.transaction_id} to={`/transactions/${row.transaction_id}`} /> },
  { label: "Status", cell: (row) => <Lifecycle status={row} /> },
  { label: "Cut", cell: (row) => (row.finalized_height === null ? "–" : <CutLink height={row.finalized_height} />) },
  { label: "Block", cell: (row) => (row.block_id === null ? "–" : <Hash id={row.block_id} to={`/blocks/${row.block_id}`} />) },
  { label: "Seen", cell: (row) => <Ago millis={row.seen_at_millis} /> },
];

const cutKey = (row: CutSummary) => row.cut.cut_id;
const blockKey = (row: BlockSummary) => row.block_id;

export function CutTable({ cuts, short, live = false }: { cuts: CutSummary[]; short?: boolean; live?: boolean }) {
  const shown = useDrip(cuts, cutKey, live);
  return <Table columns={CUT_COLUMNS} rows={shown.rows} rowKey={cutKey} empty="No cuts yet." short={short} fresh={shown.fresh} glide={shown.glide} hold={live} />;
}

export function BlockTable({ blocks, short, live = false, limit }: { blocks: BlockSummary[]; short?: boolean; live?: boolean; limit?: number }) {
  const shown = useDrip(blocks, blockKey, live, limit);
  return (
    <Table columns={BLOCK_COLUMNS} rows={shown.rows} rowKey={blockKey} empty="No blocks seen yet." short={short} fresh={shown.fresh} glide={shown.glide} hold={live} />
  );
}

export function TransactionTable({ transactions, short, live = false }: { transactions: TransactionSummary[]; short?: boolean; live?: boolean }) {
  const table = (
    <Table
      columns={TRANSACTION_COLUMNS}
      rows={transactions}
      rowKey={(row) => row.transaction_id}
      empty="No transactions seen yet."
      short={short}
      hold={live}
    />
  );
  return live ? <Steady>{table}</Steady> : table;
}

export function BlockIds({ ids, empty, fold }: { ids: string[]; empty: string; fold?: number }) {
  const [open, setOpen] = useState(false);
  if (ids.length === 0) {
    return <p className="notice">{empty}</p>;
  }
  const folded = fold !== undefined && !open && ids.length > fold;
  const list = (
    <ul className="ids">
      {(folded ? ids.slice(0, fold) : ids).map((id) => (
        <li key={id}>
          <Hash id={id} to={`/blocks/${id}`} />
        </li>
      ))}
    </ul>
  );
  if (!folded) {
    return list;
  }
  return (
    <div className="folded">
      {list}
      <div className="pager">
        <button type="button" className="page-button" onClick={() => setOpen(true)}>
          Show all {count(ids.length)}
        </button>
      </div>
    </div>
  );
}
