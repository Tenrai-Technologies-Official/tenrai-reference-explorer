import type { PrivateStatementList, PrivateStatementRow } from "@tenrai/sdk";
import type { RecentTransactions } from "../../shared/api.ts";
import { useApi } from "../api.ts";
import { TransactionTable } from "../components/lists.tsx";
import { Pager, Pending, Title, pageOf } from "../components/page.tsx";
import { type Column, Table } from "../components/table.tsx";
import { Ago, CutLink, Hash, Lifecycle, PRIVATE_KINDS } from "../components/values.tsx";
import { count } from "../format.ts";
import { useLive } from "../live.tsx";
import { Link, navigate, usePlace } from "../router.tsx";

const PRIVATE_COLUMNS: Column<PrivateStatementRow>[] = [
  { label: "Transaction", cell: (row) => <Hash id={row.digest} to={`/private/${row.digest}`} /> },
  { label: "Kind", cell: (row) => PRIVATE_KINDS[row.class] ?? row.class },
  { label: "Status", cell: (row) => <Lifecycle status={{ lifecycle: row.height === null ? "processing" : "finalized", failure: null }} /> },
  { label: "Cut", cell: (row) => (row.height === null ? "–" : <CutLink height={row.height} />) },
  { label: "Confirmations", cell: (row) => (row.height === null ? "–" : count(row.confirmations)) },
  { label: "Finalized", cell: (row) => <Ago millis={row.finalized_at_millis} /> },
];

const KINDS = [
  ["transparent", "Transparent", "/transactions"],
  ["private", "Private", "/transactions?kind=private"],
] as const;

function KindSwitch({ chosen }: { chosen: string }) {
  const { data } = useApi<{ active: boolean }>("/api/private/active");
  if (!data?.active) {
    return null;
  }
  return (
    <div className="segment kind-switch" role="group" aria-label="Kind of transaction">
      {KINDS.map(([kind, label, target]) => (
        <button key={kind} type="button" aria-pressed={kind === chosen} onClick={() => navigate(target)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function PrivateTransactions({ before }: { before: string | null }) {
  const { tick } = useLive();
  const place = before === null ? "" : `?before=${encodeURIComponent(before)}`;
  const { data, error } = useApi<PrivateStatementList>(`/api/private/statements${place}`, before === null ? tick : undefined);
  return (
    <>
      {data ? (
        <Table columns={PRIVATE_COLUMNS} rows={data.statements} rowKey={(row) => row.digest} empty="No private transactions yet." hold={before === null} />
      ) : (
        <Pending error={error} />
      )}
      <nav className="pager" aria-label="Pages">
        {before !== null && (
          <Link className="page-button" to="/transactions?kind=private">
            Newest
          </Link>
        )}
        {data && data.next_before !== null && (
          <Link className="page-button" to={`/transactions?kind=private&before=${data.next_before}`}>
            Older
          </Link>
        )}
      </nav>
    </>
  );
}

function TransparentTransactions({ page }: { page: number }) {
  const { tick } = useLive();
  const { data, error } = useApi<RecentTransactions>(`/api/transactions?page=${page}`, page === 1 ? tick : undefined);
  return (
    <>
      {data ? <TransactionTable transactions={data.transactions} live={page === 1} /> : <Pending error={error} />}
      <Pager path="/transactions" page={page} older={data?.older ?? false} />
    </>
  );
}

export function Transactions() {
  const { query } = usePlace();
  const kind = query.get("kind") === "private" ? "private" : "transparent";
  return (
    <>
      <Title eyebrow="Ledger" title={kind === "private" ? "Latest private transactions" : "Latest transactions"} />
      <KindSwitch chosen={kind} />
      {kind === "private" ? <PrivateTransactions before={query.get("before")} /> : <TransparentTransactions page={pageOf(query)} />}
    </>
  );
}
