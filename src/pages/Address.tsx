import { type AddressEvent, addressVerificationWords, addressLockProfile, isBurnAddress } from "@tenrai/sdk";
import type { ReactNode } from "react";
import type { AddressPage, UnconfirmedPayment } from "../../shared/api.ts";
import { useApi, useMore } from "../api.ts";
import { Facts, Metric, MoreButton, Pending, Section } from "../components/page.tsx";
import { QrCode } from "../components/qr.tsx";
import { type Column, Table } from "../components/table.tsx";
import { Amount, Badge, CutLink, FullId, Hash, Lifecycle } from "../components/values.tsx";
import { count, source } from "../format.ts";
import { useLive } from "../live.tsx";

const COLUMNS: Column<AddressEvent>[] = [
  { label: "Cut", cell: (row) => <CutLink height={row.finalized_height} /> },
  { label: "Event", cell: (row) => <Badge tone={row.kind === "received" ? "good" : undefined}>{row.kind}</Badge> },
  { label: "Amount", cell: (row) => <Amount atoms={row.amount} /> },
  { label: "Origin", cell: (row) => source(row.source) },
  {
    label: "Transaction",
    cell: (row) => {
      const id = row.kind === "spent" ? row.transaction_id : row.source === "regular" ? row.outpoint.transaction_id : null;
      return id === null ? "–" : <Hash id={id} to={`/transactions/${id}`} />;
    },
  },
];

const UNCONFIRMED: Column<UnconfirmedPayment>[] = [
  { label: "Transaction", cell: (row) => <Hash id={row.transaction_id} to={`/transactions/${row.transaction_id}`} /> },
  { label: "Progress", cell: (row) => <Lifecycle status={{ lifecycle: row.lifecycle, failure: null }} /> },
  { label: "Amount", cell: (row) => <Amount atoms={row.amount} /> },
];

function eventKey(event: AddressEvent): string {
  return `${event.kind}:${event.outpoint.transaction_id}:${event.outpoint.output_index}`;
}

function words(address: string): string | undefined {
  try {
    return addressVerificationWords(address).join(" · ");
  } catch {
    return undefined;
  }
}

export function Address({ address }: { address: string }) {
  const { tick } = useLive();
  const verification = words(address);
  const { data, error } = useApi<AddressPage>(`/api/address/${address}`, tick);
  const more = useMore<AddressPage>(
    data,
    (page) => page.history.next_cursor,
    (cursor) => `/api/address/${address}?cursor=${encodeURIComponent(cursor)}`,
  );
  // Deduplicate events when live updates shift page boundaries.
  const unique = new Map<string, AddressEvent>();
  for (const page of data ? [data, ...more.pages] : []) {
    for (const event of page.history.events) {
      unique.set(eventKey(event), event);
    }
  }
  const events = [...unique.values()];
  const heldFrom = data?.history.history_from ?? 0;

  return (
    <>
      <Section title="Address" action={isBurnAddress(address) ? <Badge>Burn address</Badge> : undefined}>
        <div className="address-head">
          <Facts
            rows={[
              ["Address", <FullId id={address} />],
              ["Lock profile", addressLockProfile(address)],
              ...(verification ? [["Verification words", <span className="verify-words">{verification}</span>] as [string, ReactNode]] : []),
            ]}
          />
          <QrCode text={address} label="QR code of this address" />
        </div>
        {isBurnAddress(address) && <p className="notice">No key can spend from this address. Every transaction output paid to it is burned and leaves the supply.</p>}
      </Section>
      {data ? (
        <>
          <div className="grid metrics">
            <Metric label="Balance" value={<Amount atoms={data.balance.balance} />} note="finalized" />
            <Metric label="Unspent outputs" value={count(data.balance.utxos)} />
            <Metric label="Indexed up to" value={<CutLink height={data.balance.indexed_height} />} />
            <Metric label="Staked" value={data.staked === null ? "–" : <Amount atoms={data.staked} />} />
          </div>
          {data.unconfirmed.length > 0 && (
            <Section title={`Unconfirmed (${count(data.unconfirmed.length)})`}>
              <p className="notice">These payments are not final and not part of the balance yet.</p>
              <Table columns={UNCONFIRMED} rows={data.unconfirmed} rowKey={(row) => row.transaction_id} empty="" />
            </Section>
          )}
          <Section title="History">
            {heldFrom > 0 && !more.more ? (
              <p className="notice">This node holds the history from cut {count(heldFrom)} on; older entries may exist.</p>
            ) : null}
            <Table columns={COLUMNS} rows={events} rowKey={eventKey} empty={heldFrom > 0 ? "Nothing in the history this node holds." : "Nothing received or spent yet."} />
            <MoreButton {...more} />
          </Section>
        </>
      ) : (
        <Pending error={error} />
      )}
    </>
  );
}
