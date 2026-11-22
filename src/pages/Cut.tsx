import type { CutTransactions, RewardReference, StakePayoutReference, TransactionView } from "@tenrai/sdk";
import type { ReactNode } from "react";
import type { CutPage } from "../../shared/api.ts";
import { useApi, useMore } from "../api.ts";
import { BlockIds } from "../components/lists.tsx";
import { Facts, MoreButton, Pending, Section, Title } from "../components/page.tsx";
import { type Column, Table } from "../components/table.tsx";
import { AddressLink, Ago, Amount, CutLink, FullId, Hash, Lifecycle } from "../components/values.tsx";
import { count, cutRewards, sum } from "../format.ts";
import { useLive } from "../live.tsx";
import { Link } from "../router.tsx";
import { RewardSettlementNotice } from "../components/reward-settlement.ts";

const COLUMNS: Column<TransactionView>[] = [
  { label: "Transaction", cell: (row) => <Hash id={row.transaction_id} to={`/transactions/${row.transaction_id}`} /> },
  { label: "Kind", cell: (row) => row.kind },
  { label: "Output", cell: (row) => <Amount atoms={row.output_total} /> },
  { label: "Fee", cell: (row) => <Amount atoms={row.fee} /> },
  { label: "Status", cell: (row) => <Lifecycle status={row.status} /> },
];

function paidTo(owners: Record<string, string>, output: { transaction_id: string; output_index: number }) {
  const address = owners[`${output.transaction_id}:${output.output_index}`];
  return address === undefined ? "–" : <AddressLink address={address} />;
}

function minerColumns(owners: Record<string, string>): Column<RewardReference>[] {
  return [
    { label: "Block", cell: (row) => <Hash id={row.block_id} to={`/blocks/${row.block_id}`} /> },
    { label: "Paid to", cell: (row) => paidTo(owners, row) },
    { label: "Amount", cell: (row) => <Amount atoms={row.amount} /> },
  ];
}

function stakerColumns(owners: Record<string, string>): Column<StakePayoutReference>[] {
  return [
    { label: "Position", cell: (row) => <Hash id={row.position_id} /> },
    { label: "Paid to", cell: (row) => paidTo(owners, row) },
    { label: "Amount", cell: (row) => <Amount atoms={row.amount} /> },
  ];
}

const FOLD = 10;

function payoutRow(from: number | null, head: number): [string, ReactNode][] {
  if (from === null) {
    return [];
  }
  return [["Paid out from cut", from <= head ? <CutLink height={from} /> : count(from)]];
}
const BLOCK_FOLD = 24;

const outputKey = (row: { transaction_id: string; output_index: number }) => `${row.transaction_id}:${row.output_index}`;

export function Cut({ height }: { height: number }) {
  const { tick } = useLive();
  const { data, error } = useApi<CutPage>(`/api/cuts/${height}`, tick);
  const more = useMore<CutTransactions>(
    data?.transactions,
    (page) => page.next_cursor,
    (cursor) => `/api/cuts/${height}/transactions?cursor=${cursor}`,
  );
  if (!data) {
    return (
      <>
        <Title eyebrow="Cut" title={`Cut ${count(height)}`} />
        <Pending error={error} />
      </>
    );
  }
  const { cut } = data;
  const transactions = [data.transactions, ...more.pages].flatMap((page) => page.transactions);
  const miners = cut.rewards === null ? null : sum(cut.rewards.map((reward) => reward.amount));
  const payouts = cut.stake_payouts ?? [];
  const rewards = cutRewards(miners, cut.stake_rewards);

  return (
    <>
      <Title eyebrow="Cut" title={`Cut ${count(height)}`}>
        <nav className="pager" aria-label="Neighbouring cuts">
          {height > 0 && (
            <Link className="page-button" to={`/cuts/${height - 1}`}>
              Previous
            </Link>
          )}
          {cut.confirmations > 1 && (
            <Link className="page-button" to={`/cuts/${height + 1}`}>
              Next
            </Link>
          )}
        </nav>
      </Title>

      <Facts
        rows={[
          ["Cut", <FullId id={cut.cut.cut_id} />],
          ["Finalized", <Ago millis={cut.finalized_at_millis} />],
          ["Confirmations", count(cut.confirmations)],
          ["Work confirmations", cut.work_confirmations === null ? "–" : count(cut.work_confirmations)],
          ["Epoch", count(cut.epoch)],
          ["Transactions", count(cut.transactions)],
          ["Rewards", rewards === null ? "Not retained" : <Amount atoms={rewards} />],
          ["State root", <span className="mono">{cut.cut.state_root}</span>],
          ["Validator set", <span className="mono">{cut.cut.validator_set_id}</span>],
          ["Protocol", `version ${cut.protocol_version}`],
        ]}
      />

      <RewardSettlementNotice />
      <div className="columns">
        <Section title="Settled mining rewards">
          {cut.rewards === null || miners === null ? (
            <p className="notice">Not retained.</p>
          ) : (
            <>
              <Facts
                rows={[
                  ["Settled mining rewards", <Amount atoms={miners} />],
                  ["Blocks settled", count(cut.rewards.length)],
                ]}
              />
              <Table columns={minerColumns(data.paidTo)} rows={cut.rewards} rowKey={outputKey} empty="This cut paid no mining rewards." fold={FOLD} />
            </>
          )}
        </Section>
        <Section title="Settled staking rewards">
          {cut.stake_rewards === null ? (
            <p className="notice">Not retained.</p>
          ) : (
            <>
              <Facts
                rows={[
                  ["To the staking pool", <Amount atoms={cut.stake_rewards} />],
                  ...payoutRow(data.payoutFrom, height + cut.confirmations - 1),
                  ["Settled staking rewards", <Amount atoms={sum(payouts.map((payout) => payout.amount))} />],
                  ["Positions settled", count(payouts.length)],
                ]}
              />
              <Table columns={stakerColumns(data.paidTo)} rows={payouts} rowKey={outputKey} empty="No position payouts in this cut." fold={FOLD} />
            </>
          )}
        </Section>
      </div>

      <div className="columns">
        <Section title={`Registered blocks (${count(cut.registered_blocks.length)})`}>
          <BlockIds ids={cut.registered_blocks} empty="This cut registered no blocks." fold={BLOCK_FOLD} />
        </Section>
        <Section title={`Executed blocks (${count(cut.executed_blocks.length)})`}>
          <BlockIds ids={cut.executed_blocks} empty="This cut executed no blocks." fold={BLOCK_FOLD} />
        </Section>
      </div>

      {data.privateItems && data.privateItems.statements.length + data.privateItems.registrations.length > 0 && (
        <Section title="Private items">
          <p className="notice">
            {count(data.privateItems.statements.length)} private statements and {count(data.privateItems.registrations.length)} registrations ran in this cut.
          </p>
          <ul className="plain-list">
            {data.privateItems.statements.map((statement) => (
              <li key={statement.digest}>
                {statement.class}: <Hash id={statement.digest} to={`/private/${statement.digest}`} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Transactions">
        <Table columns={COLUMNS} rows={transactions} rowKey={(row) => row.transaction_id} empty="This cut executed no transactions." />
        <MoreButton {...more} />
      </Section>
    </>
  );
}
