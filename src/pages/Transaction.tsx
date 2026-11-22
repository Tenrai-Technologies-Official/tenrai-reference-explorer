import { type OperationView, type OutputView, isBurnAddress, isFinal } from "@tenrai/sdk";
import { type ReactNode, useEffect, useState } from "react";
import type { TransactionPage } from "../../shared/api.ts";
import { hasNativeFundingOutput, NATIVE_DISPLAY_NOTICE, NATIVE_FUNDING_NOTICE } from "../../shared/native-locks.ts";
import { getJson, useApi } from "../api.ts";
import { Facts, Pending, Section, Title } from "../components/page.tsx";
import { type Column, Table } from "../components/table.tsx";
import { NativeLockAuthorizationFacts } from "../components/native-lock-authorization.ts";
import { INPUT_COLUMNS } from "../components/lists.tsx";
import { AddressLink, Ago, Amount, Badge, CutLink, FullId, Hash, PrivateStages, Stages } from "../components/values.tsx";
import { count, shortId } from "../format.ts";
import { useLive } from "../live.tsx";
import { Link, navigate } from "../router.tsx";

const OPEN_POLL_MILLIS = 1_000;
const MAX_AUTHORIZATION_ROWS = 64;

function transactionTitle(kind: string): string {
  if (kind === "private_enter") return "Private ENTER";
  if (kind === "private_register") return "Private account registration";
  if (kind === "commission") return "Validator commission change";
  if (kind === "endpoint") return "Validator endpoint change";
  return `${kind} transaction`;
}

function operationTitle(kind: string): string {
  if (kind === "private_enter") return "Private ENTER";
  if (kind === "private_register") return "Private account registration";
  if (kind === "commission") return "Validator commission change";
  return kind === "endpoint" ? "Validator endpoint change" : kind;
}

const OUTPUTS: Column<OutputView>[] = [
  { label: "#", cell: (row) => row.index },
  {
    label: "To",
    cell: (row) =>
      isBurnAddress(row.address) ? (
        <span className="check">
          <AddressLink address={row.address} />
          <Badge>Burned</Badge>
        </span>
      ) : (
        <AddressLink address={row.address} />
      ),
  },
  { label: "Amount", cell: (row) => <Amount atoms={row.amount} /> },
];

function outputColumns(transaction: TransactionPage): Column<OutputView>[] {
  const perRecipient = transaction.recipient_payloads;
  if (!perRecipient) {
    return OUTPUTS;
  }
  const payload = (row: OutputView) => perRecipient.find((entry) => entry.output === row.index);
  return [
    ...OUTPUTS,
    {
      label: "Payload",
      cell: (row) => {
        const entry = payload(row);
        if (!entry) {
          return "—";
        }
        return entry.text !== null ? <span className="payload">{entry.text}</span> : <span className="mono">hex {entry.payload_hex}</span>;
      },
    },
  ];
}

export function Transaction({ id }: { id: string }) {
  const { tick } = useLive();
  const [poll, setPoll] = useState(0);
  const { data: transaction, error } = useApi<TransactionPage>(`/api/transactions/${id}`, `${tick}:${poll}`);
  // An EXIT statement ID can appear as the creating transaction of a public output.
  const missing = error?.status === 404;
  useEffect(() => {
    if (!missing) {
      return;
    }
    let current = true;
    getJson(`/api/private/statements/${id}`).then(
      () => {
        if (current) {
          navigate(`/private/${id}`, { replace: true });
        }
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [missing, id]);
  const open = transaction !== undefined && !isFinal(transaction.status);
  // Poll for mining and registration between finalized cuts.
  useEffect(() => {
    if (!open) {
      return;
    }
    const timer = setTimeout(() => setPoll((value) => value + 1), OPEN_POLL_MILLIS);
    return () => clearTimeout(timer);
  }, [open, transaction]);

  return (
    <>
      <Title eyebrow={transaction ? transactionTitle(transaction.kind) : "Transaction"} title="Transaction">
        <FullId id={id} />
      </Title>
      {transaction ? <Details transaction={transaction} /> : <Pending error={error} />}
    </>
  );
}

function Details({ transaction }: { transaction: TransactionPage }) {
  const { status } = transaction;
  const registered = status.registered_cut;
  const finalized = status.finalized_cut;
  const mined = status.observed_work?.block_id ?? transaction.block_id;
  const missing = status.lifecycle === "failed" ? "None" : "Not yet";
  // A private ENTER executes directly in a cut.
  const enter = transaction.kind === "private_enter" || transaction.kind === "private_register";
  const placed: [string, ReactNode][] = enter
    ? []
    : [
        ["Mined in block", mined ? <Hash id={mined} to={`/blocks/${mined}`} /> : missing],
        ["Registered in cut", registered ? <CutLink height={registered.height} /> : missing],
      ];
  // Execution settles the status regardless of the validity window.
  const validity: [string, ReactNode][] = status.lifecycle === "finalized"
    ? []
    : [["Valid", `from cut ${count(transaction.valid_from_height)} to ${count(transaction.valid_until_height)}`]];
  return (
    <>
      {transaction.retention === "compact" && (
        <p className="notice" role="status">
          Witness data pruned. This is locally recorded display data. Canonical wire download and signature verification are unavailable.
        </p>
      )}
      <Facts
        rows={[
          ["Status", enter ? <PrivateStages final={Boolean(finalized)} /> : <Stages status={status} />],
          ...placed,
          ["Finalized in cut", finalized ? <CutLink height={finalized.height} /> : missing],
          ["Confirmations", count(transaction.confirmations)],
          ["Finalized", <Ago millis={transaction.finalized_at_millis} />],
          ["Input total", <Amount atoms={transaction.input_total ?? null} />],
          ["Sent", <Amount atoms={transaction.output_total} />],
          ["Fee", <Amount atoms={transaction.fee} />],
          ["Mass", `${count(transaction.mass)}, ${count(transaction.wire_bytes)} bytes`],
          ...validity,
          transaction.retention === "compact"
            ? ["Recorded signature checks", count(transaction.signature_checks)]
            : ["Signatures", count(transaction.witnesses)],
          transaction.retention === "compact"
            ? ["Recorded witness ID", <FullId id={transaction.recorded_witness_id} />]
            : ["Witness ID", <FullId id={transaction.witness_id} />],
          ["Payload", <Payload transaction={transaction} />],
        ]}
      />
      <PrivateFunding transaction={transaction} />
      {transaction.operation && (
        <Section title={`Operation: ${operationTitle(transaction.operation.type)}`}>
          <Facts rows={operationRows(transaction.operation)} />
        </Section>
      )}
      <ThresholdAuthorizations transaction={transaction} />
      <NativeLockAuthorizations transaction={transaction} />
      <div className="columns">
        <Section title={`Inputs (${count(transaction.inputs.length)})`}>
          <Table
            columns={INPUT_COLUMNS}
            rows={transaction.inputs}
            rowKey={(row) => `${row.transaction_id}:${row.output_index}`}
            empty="No inputs."
          />
        </Section>
        <Section title={`Outputs (${count(transaction.outputs.length)})`}>
          {hasNativeFundingOutput(transaction.outputs) && <p className="notice">{NATIVE_FUNDING_NOTICE}</p>}
          <Table columns={outputColumns(transaction)} rows={transaction.outputs} rowKey={(row) => String(row.index)} empty="No outputs." />
        </Section>
      </div>
    </>
  );
}

function PrivateFunding({ transaction }: { transaction: TransactionPage }) {
  if (transaction.retention !== "compact" || !transaction.private_funding) return null;
  const funding = transaction.private_funding;
  const rows: [string, ReactNode][] = funding.kind === "enter"
    ? [["Private transaction", <Link className="link mono" to={`/private/${funding.statement_id}`}>{funding.statement_id}</Link>]]
    : [["Registration frame ID", <FullId id={funding.registration_id} />], ["Authorization ID", <FullId id={funding.authorization_id} />], ["Owner lock", <span className="mono">{funding.owner_lock_hex}</span>]];
  return <Section title={funding.kind === "enter" ? "Private ENTER funding" : "Private account registration"}><Facts rows={rows} /></Section>;
}
function ThresholdAuthorizations({ transaction }: { transaction: TransactionPage }) {
  const authorizations = (transaction.retention === "compact" ? [] : transaction.authorizations)
    .filter((authorization) => authorization.profile === "threshold_mldsa65")
    .filter((authorization) => authorization.input_index >= 0 && authorization.input_index < transaction.inputs.length)
    .slice(0, MAX_AUTHORIZATION_ROWS);
  if (authorizations.length === 0) {
    return null;
  }
  return (
    <Section title="Transparent threshold authorization">
      <Facts
        rows={authorizations.map((authorization) => {
          const complete = authorization.signature_count >= authorization.threshold;
          return [
            `Input ${count(authorization.input_index + 1)}`,
            `${count(authorization.signature_count)} of ${count(authorization.threshold)} signatures, ${count(authorization.member_count)} members, ${complete ? "complete" : "incomplete"}`,
          ];
        })}
      />
    </Section>
  );
}

function NativeLockAuthorizations({ transaction }: { transaction: TransactionPage }) {
  const records = transaction.retention === "compact" ? transaction.native_spends : transaction.authorizations;
  const native = records.filter((authorization) => authorization.profile === "native_lock").slice(0, MAX_AUTHORIZATION_ROWS);
  if (native.length === 0) return null;
  return <Section title="Native lock authorization"><p className="notice">{NATIVE_DISPLAY_NOTICE}</p>{native.map((authorization, index) => <NativeLockAuthorizationFacts key={`${authorization.input_index}:${index}`} authorization={authorization} inputs={transaction.inputs} />)}</Section>;
}

function Payload({ transaction }: { transaction: TransactionPage }) {
  if (!transaction.payload_hex) {
    return <>None</>;
  }
  if (transaction.messenger) {
    return <>Messenger payload</>;
  }
  if (transaction.recipient_payloads) {
    return <>One per recipient, shown with the outputs</>;
  }
  if (transaction.payload_text !== null) {
    return <span className="payload">{transaction.payload_text}</span>;
  }
  return <span className="mono">{transaction.payload_hex}</span>;
}

function operationRows(operation: OperationView): [string, ReactNode][] {
  return Object.entries(operation.data).map(([key, value]: [string, unknown]) => [
    key === "statement_digest" ? "Private transaction" : key.charAt(0).toUpperCase() + key.slice(1).replaceAll("_", " "),
    operationValue(key, value),
  ]);
}

function operationValue(key: string, value: unknown): ReactNode {
  if (typeof value === "number") {
    return count(value);
  }
  if (typeof value !== "string") {
    return String(value);
  }
  if (key.endsWith("_address")) {
    return <AddressLink address={value} full />;
  }
  if (key === "statement_digest") {
    return (
      <Link className="link mono" to={`/private/${value}`}>
        {shortId(value)}
      </Link>
    );
  }
  if (key === "amount" || key === "self_bond") {
    return <Amount atoms={value} />;
  }
  return <span className="mono">{value.length > 96 ? shortId(value) : value}</span>;
}
