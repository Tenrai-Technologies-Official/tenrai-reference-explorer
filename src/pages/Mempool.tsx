import type { MempoolEntry } from "@tenrai/sdk";
import type { MempoolPage } from "../../shared/api.ts";
import { useApi } from "../api.ts";
import { Metric, Pending, Section, Title } from "../components/page.tsx";
import { type Column, Table } from "../components/table.tsx";
import { Amount, Hash } from "../components/values.tsx";
import { atoms, bytes, count, percent } from "../format.ts";
import { useLive } from "../live.tsx";

const COLUMNS: Column<MempoolEntry>[] = [
  { label: "Transaction", cell: (row) => <Hash id={row.transaction_id} to={`/transactions/${row.transaction_id}`} /> },
  { label: "Fee", cell: (row) => <Amount atoms={row.fee} /> },
  { label: "Per mass", cell: (row) => atoms(row.fee_per_mass) },
  { label: "Mass", cell: (row) => count(row.mass) },
  { label: "Size", cell: (row) => bytes(row.wire_bytes) },
];

export function Mempool() {
  const { tick } = useLive();
  const { data, error } = useApi<MempoolPage>("/api/mempool", tick);

  return (
    <>
      <Title eyebrow="Waiting" title="Mempool" />
      {data ? <Details page={data} /> : <Pending error={error} />}
    </>
  );
}

function Details({ page: { info, fees, pool } }: { page: MempoolPage }) {
  return (
    <>
      <div className="grid metrics">
        <Metric label="Transactions" value={count(info.transactions)} note={`of at most ${count(info.max_transactions)}`} />
        <Metric label="Mass" value={count(info.mass)} note={`${percent(info.mass, info.max_mass)} of ${count(info.max_mass)}`} />
        <Metric label="Size" value={bytes(info.wire_bytes)} note={`of at most ${bytes(info.max_wire_bytes)}`} />
        <Metric
          label="Lowest fee in the pool"
          value={info.lowest_fee_per_mass === null ? "–" : atoms(info.lowest_fee_per_mass)}
          note="per unit of mass"
        />
      </div>

      <Section title="Fee estimate">
        <div className="grid">
          {fees.suggestions.map((suggestion) => (
            <Metric
              key={suggestion.priority}
              label={suggestion.priority}
              value={`${atoms(suggestion.fee_per_mass)} per mass`}
              note={`${count(suggestion.mass_ahead)} mass ahead of it`}
            />
          ))}
        </div>
      </Section>

      <Section title={`Waiting transactions (${count(pool.total)})`}>
        <Table columns={COLUMNS} rows={pool.entries} rowKey={(row) => row.transaction_id} empty="The pool is empty." />
      </Section>
    </>
  );
}
