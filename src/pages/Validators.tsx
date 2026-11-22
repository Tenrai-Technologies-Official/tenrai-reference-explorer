import type { ValidatorList, ValidatorView } from "@tenrai/sdk";
import { useApi, useMore } from "../api.ts";
import { Metric, MoreButton, Pending, Section, Title } from "../components/page.tsx";
import { type Column, Table } from "../components/table.tsx";
import { Amount, Badge, CutLink, Hash } from "../components/values.tsx";
import { count } from "../format.ts";
import { activityText, attendanceText, commissionText, heartbeatText, jailText, pendingCommissionText, useStakingRefresh } from "../staking.ts";

const COLUMNS: Column<ValidatorView>[] = [
  { label: "Validator", cell: (row) => <Hash id={row.validator_id} to={`/validators/${row.validator_id}`} /> },
  {
    label: "Status",
    cell: (row) => <Badge tone={row.is_active ? "good" : "wait"}>{activityText(row)}</Badge>,
  },
  {
    label: "Participation",
    cell: (row) => (
      <span>
        {heartbeatText(row)}
        <small className="note">Attendance: {attendanceText(row)} · Jail: {jailText(row)}</small>
      </span>
    ),
  },
  {
    label: "Commission",
    cell: (row) => (
      <span>
        {commissionText(row)}
        {row.pending_commission !== null && <small className="note">{pendingCommissionText(row)}</small>}
      </span>
    ),
  },
  {
    label: "Slots",
    cell: (row) => (
      <span>
        {count(row.available_position_slots)} free
        <small className="note">of {count(row.position_capacity)}</small>
      </span>
    ),
  },
  {
    label: "Delegations",
    cell: (row) => <Badge tone={row.accepting_delegations ? "good" : "wait"}>{row.accepting_delegations ? "Open" : "Closed"}</Badge>,
  },
  {
    label: "Exit",
    cell: (row) => (row.exit_request_height === null ? "–" : <CutLink height={row.exit_request_height} />),
  },
];

export function Validators() {
  const refresh = useStakingRefresh();
  const { data, error } = useApi<ValidatorList>("/api/validators", refresh);
  const more = useMore<ValidatorList>(
    data,
    (page) => page.next_cursor,
    (cursor) => `/api/validators?cursor=${encodeURIComponent(cursor)}`,
  );
  const entries = uniqueValidators(data ? [data, ...more.pages] : []);

  return (
    <>
      <Title eyebrow="Staking" title="Validators" />
      {data ? (
        <>
          <div className="grid metrics">
            <Metric
              label="Validator slots"
              value={count(data.validator_capacity - data.available_validator_slots)}
              note={`${count(data.available_validator_slots)} available of ${count(data.validator_capacity)}`}
            />
            <Metric
              label="Stake positions"
              value={count(data.live_positions)}
              note={`${count(data.available_position_slots)} free of ${count(data.position_capacity)}`}
            />
            <Metric label="Total bonded" value={<Amount atoms={data.total_bonded} />} />
            <Metric label="Minimum delegation" value={<Amount atoms={data.minimum_delegation} />} />
          </div>
          <Section title="Registered validators">
            <Table columns={COLUMNS} rows={entries} rowKey={(row) => row.validator_id} empty="No validators are registered." />
            <MoreButton {...more} />
          </Section>
        </>
      ) : (
        <Pending error={error} />
      )}
    </>
  );
}

function uniqueValidators(pages: ValidatorList[]): ValidatorView[] {
  const validators = new Map<string, ValidatorView>();
  for (const page of pages) {
    for (const validator of page.validators) {
      if (!validators.has(validator.validator_id)) {
        validators.set(validator.validator_id, validator);
      }
    }
  }
  return [...validators.values()];
}
