import type { StakePositionView, ValidatorPositionList, ValidatorSlashStatus } from "@tenrai/sdk";
import type { ValidatorPage } from "../../shared/api.ts";
import { useApi, useMore } from "../api.ts";
import { Facts, Metric, MoreButton, Pending, Section, Title } from "../components/page.tsx";
import { type Column, Table } from "../components/table.tsx";
import { AddressLink, Amount, Badge, Copy, CutLink, FullId } from "../components/values.tsx";
import { count, shortId } from "../format.ts";
import {
  activityText,
  attendanceText,
  commissionText,
  heartbeatText,
  jailText,
  pendingCommissionText,
  pendingEndpointText,
  pendingKeyRotationText,
  positionStateText,
  useStakingRefresh,
} from "../staking.ts";

const COLUMNS: Column<StakePositionView>[] = [
  { label: "Owner", cell: (row) => <AddressLink address={row.owner_address} /> },
  { label: "Rewards to", cell: (row) => <AddressLink address={row.reward_address} /> },
  { label: "Principal", cell: (row) => <Amount atoms={row.principal} /> },
  { label: "Kind", cell: (row) => (row.kind === "self_bond" ? "Self bond" : "Delegation") },
  { label: "State", cell: (row) => <Badge tone={row.state === "bonded" ? "good" : "wait"}>{positionStateText(row)}</Badge> },
  {
    label: "Reward snapshot",
    cell: (row) => <Badge tone={row.future_rewards_eligible ? "good" : "wait"}>{row.future_rewards_eligible ? "Included" : "Excluded"}</Badge>,
  },
  { label: "Exit", cell: (row) => (row.exit_request_height === null ? "–" : <CutLink height={row.exit_request_height} />) },
];

export function Validator({ id }: { id: string }) {
  const refresh = useStakingRefresh();
  const { data, error } = useApi<ValidatorPage>(`/api/validators/${id}`, refresh);
  const more = useMore<ValidatorPositionList>(
    data?.positions,
    (page) => page.next_cursor,
    (cursor) => `/api/validators/${id}/positions?cursor=${encodeURIComponent(cursor)}`,
  );
  if (!data) {
    return (
      <>
        <Title eyebrow="Staking" title="Validator" />
        <Pending error={error} />
      </>
    );
  }
  const { validator } = data.detail;
  const positions = uniquePositions([data.positions, ...more.pages]);
  const active = validator.is_active;

  return (
    <>
      <Title eyebrow="Staking" title={`Validator ${shortId(validator.validator_id)}`} />
      <Facts
        rows={[
          ["Validator", <FullId id={validator.validator_id} />],
          ["Owner", <AddressLink address={validator.owner_address} full />],
          ["Status", <Badge tone={active ? "good" : "wait"}>{activityText(validator)}</Badge>],
          ["New delegations", <Badge tone={validator.accepting_delegations ? "good" : "wait"}>{validator.accepting_delegations ? "Accepted" : "Closed"}</Badge>],
          ["Current commission", commissionText(validator)],
          ["Scheduled commission", pendingCommissionText(validator)],
          ["Activation", `Epoch ${count(validator.activation_epoch)}, cut ${count(validator.activation_height)}`],
          ["Last heartbeat", heartbeatText(validator)],
          ["Last certified attendance", attendanceText(validator)],
          ["Jail status", jailText(validator)],
          ["Slash status", <SlashStatus status={data.slash} />],
          ["Consensus key", <ConsensusKey value={validator.consensus_public_key} version={validator.consensus_key_version} />],
          ["Overlay endpoint", <Endpoint value={validator.overlay_endpoint_hex} />],
          ["Scheduled overlay endpoint", validator.pending_endpoint === null ? "None" : <Endpoint value={validator.pending_endpoint.overlay_endpoint_hex} note={pendingEndpointText(validator)} />],
          ["Pending key rotation", pendingKeyRotationText(validator)],
          ["Exit requested", validator.exit_request_height === null ? "–" : <CutLink height={validator.exit_request_height} />],
        ]}
      />
      <div className="grid metrics">
        <Metric label="Bonded" value={<Amount atoms={data.positions.total_bonded} />} />
        <Metric label="Delegated" value={<Amount atoms={data.positions.delegated} />} />
        <Metric label="Stakers" value={count(data.positions.stakers)} />
        <Metric
          label="Open slots"
          value={count(data.positions.available_position_slots)}
          note={`of ${count(data.positions.position_capacity)}`}
        />
      </div>
      <Section title="Stake positions">
        <Table columns={COLUMNS} rows={positions} rowKey={(row) => row.position_id} empty="No live stake positions." />
        <MoreButton {...more} />
      </Section>
    </>
  );
}

function ConsensusKey({ value, version }: { value: string; version: number }) {
  return (
    <span className="copyable">
      <span className="mono" title={value}>
        v{count(version)} {shortId(value)}
      </span>
      <Copy text={value} />
    </span>
  );
}

function Endpoint({ value, note }: { value: string; note?: string }) {
  return (
    <span className="copyable">
      <span className="mono" title={value}>{shortId(value)}</span>
      <Copy text={value} />
      {note && <small className="note">{note}</small>}
    </span>
  );
}

function SlashStatus({ status }: { status: ValidatorSlashStatus }) {
  const forfeiture = status.active_forfeiture;
  if (forfeiture === null) {
    return <Badge tone="good">No retained slash record</Badge>;
  }
  return (
    <span>
      <Badge tone="bad">Slash recorded</Badge>
      <small className="note">
        <Amount atoms={forfeiture.burned_principal} /> burned across {count(forfeiture.position_count)} stake positions; evidence at <CutLink height={forfeiture.evidence_height} />, retained through{" "}
        <CutLink height={forfeiture.retire_height} />.
      </small>
    </span>
  );
}

function uniquePositions(pages: ValidatorPositionList[]): StakePositionView[] {
  const positions = new Map<string, StakePositionView>();
  for (const page of pages) {
    for (const position of page.positions) {
      if (!positions.has(position.position_id)) {
        positions.set(position.position_id, position);
      }
    }
  }
  return [...positions.values()];
}
