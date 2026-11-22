import type { PrivateStatement as Statement } from "@tenrai/sdk";
import type { ReactNode } from "react";
import { useApi } from "../api.ts";
import { INPUT_COLUMNS } from "../components/lists.tsx";
import { Facts, Pending, Section, Title } from "../components/page.tsx";
import { Table } from "../components/table.tsx";
import { AddressLink, Ago, Amount, CutLink, FullId, PRIVATE_KINDS, PRIVATE_PATH, PrivateStages } from "../components/values.tsx";
import { count } from "../format.ts";
import { useLive } from "../live.tsx";

export function PrivateStatement({ digest }: { digest: string }) {
  const { tick } = useLive();
  const { data, error } = useApi<Statement>(`/api/private/statements/${digest}`, tick);
  if (!data) {
    return (
      <>
        <Title eyebrow="Private transaction" title="Private transaction" />
        <Pending error={error} />
      </>
    );
  }
  const details = data.details;
  const final = data.height !== null;
  // After execution, use the finalized status instead of the validity window.
  const validity: [string, ReactNode][] = details && !final
    ? [["Valid", `from cut ${count(details.valid_from_height)} to ${count(details.valid_until_height)}`]]
    : [];
  return (
    <>
      <Title eyebrow="Private transaction" title={PRIVATE_KINDS[data.class] ?? data.class} />
      <p className="notice">Amounts inside the private pool, owners and who paid whom stay hidden. This page shows what the transaction made public.</p>
      <Facts
        rows={[
          ["Status", <PrivateStages final={final} />],
          ["Path", PRIVATE_PATH],
          ["Finalized in cut", data.height === null ? "Not yet" : <CutLink height={data.height} />],
          ["Confirmations", count(data.confirmations)],
          ["Finalized", <Ago millis={data.finalized_at_millis} />],
          ["Digest", <FullId id={data.digest} />],
          ...(details
            ? ([
                ["Fee", <Amount atoms={details.fee} />],
                ["Size", `${count(details.bytes)} bytes`],
                ["Proof", `${count(details.proof_bytes)} bytes`],
                ["Anchor", <CutLink height={details.anchor_height} />],
                ...validity,
                ...(details.entered === null ? [] : [["Brought in", <Amount atoms={details.entered} />]]),
                ...(details.exited === null ? [] : [["Paid out", <Amount atoms={details.exited} />]]),
                ...(details.address === null ? [] : [["Paid to", <AddressLink address={details.address} />]]),
              ] as [string, ReactNode][])
            : []),
        ]}
      />
      {!details && <p className="notice">This node no longer keeps the bytes of this private transaction.</p>}
      {details && details.spent.length > 0 && (
        <Section title="Outputs it spent">
          <Table
            columns={INPUT_COLUMNS}
            rows={details.spent}
            rowKey={(row) => `${row.transaction_id}:${row.output_index}`}
            empty="No inputs."
          />
        </Section>
      )}
      {details && details.nullifiers.length > 0 && (
        <Section title="Nullifiers it made permanent">
          <ul className="plain-list">
            {details.nullifiers.map((nullifier) => (
              <li key={nullifier}>
                <FullId id={nullifier} />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {details && details.notes.length > 0 && (
        <Section title="Notes it appended">
          <ul className="plain-list">
            {details.notes.map((note) => (
              <li key={note.commitment}>
                <FullId id={note.commitment} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
