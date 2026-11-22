import type { BlockReward, BlockState, BlockView } from "@tenrai/sdk";
import type { ReactNode } from "react";
import type { BlockPage, PaidIn } from "../../shared/api.ts";
import { useApi } from "../api.ts";
import { BlockIds } from "../components/lists.tsx";
import { Facts, Pending, Section, Title } from "../components/page.tsx";
import { AddressLink, Ago, Amount, Badge, CutLink, FullId, Hash } from "../components/values.tsx";
import { count } from "../format.ts";
import { useLive } from "../live.tsx";

const STATES: Record<BlockState, "good" | "wait" | undefined> = {
  pooled: "wait",
  registered: "wait",
  executed: "good",
  retained: undefined,
};

export function Block({ id }: { id: string }) {
  const { tick } = useLive();
  const { data, error } = useApi<BlockPage>(`/api/blocks/${id}`, tick);

  return (
    <>
      <Title eyebrow="Work block" title="Block">
        <FullId id={id} />
      </Title>
      {data ? <Details block={data.block} paidIn={data.paidIn} /> : <Pending error={error} />}
    </>
  );
}

function Details({ block, paidIn }: { block: BlockView; paidIn: PaidIn | string | null }) {
  const reward = block.reward;
  return (
    <>
      <Facts
        rows={[
          ["State", <Badge tone={STATES[block.state]}>{block.state}</Badge>],
          ["Registered in", block.registration_height === null ? "Not yet" : <CutLink height={block.registration_height} />],
          ["Executed in", block.execution_height === null ? "Not yet" : <CutLink height={block.execution_height} />],
          ["Confirmations", count(block.confirmations)],
          ["Work confirmations", block.work_confirmations === null ? "–" : count(block.work_confirmations)],
          ["Finalized", <Ago millis={block.finalized_at_millis} />],
          ["Reward to", <AddressLink address={block.reward_address} full />],
          ["Miner", block.miner_tag ?? "No tag"],
          ["Payload", `${count(block.payload_length)} bytes, mass ${count(block.payload_mass)}`],
          ["Work reference", <Hash id={block.work_ref} />],
          ["Nonce", <span className="mono">{block.nonce}</span>],
          ["Extranonce", <span className="mono">{block.extranonce}</span>],
          ["Protocol", `version ${block.protocol_version}`],
        ]}
      />
      <Section title="Rewards">
        <Facts rows={rewardRows(reward, paidIn)} />
      </Section>
      <div className="columns">
        <Section title={`Parents (${count(block.parents.length)})`}>
          <BlockIds ids={block.parents} empty="This block names no parents." />
        </Section>
        <Section title={`Transactions (${count(block.transaction_ids.length)})`}>
          {block.transaction_ids.length === 0 ? (
            <p className="notice">This block carries no transactions.</p>
          ) : (
            <ul className="ids">
              {block.transaction_ids.map((transaction) => (
                <li key={transaction}>
                  <Hash id={transaction} to={`/transactions/${transaction}`} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

const NOT_EXECUTED = "Not executed yet";
const NOT_PAID = "Not paid yet";

function rewardRows(reward: BlockReward | null, paidIn: PaidIn | string | null): [string, ReactNode][] {
  if (reward === null) {
    return [
      ["Miner reward", NOT_EXECUTED],
      ["Staker rewards", NOT_EXECUTED],
    ];
  }
  const known = paidIn !== null && typeof paidIn === "object";
  return [
    ["Miner reward", <Reward reward={reward} />],
    ["Subsidy", reward.subsidy === null ? "When the anchor closes" : <Amount atoms={reward.subsidy} />],
    ["Fees", <Amount atoms={reward.fees} />],
    ["Paid in cut", paidIn === null ? NOT_PAID : known ? <CutLink height={paidIn.height} /> : paidIn],
    [
      "Staker rewards",
      paidIn === null ? (
        NOT_PAID
      ) : !known ? (
        paidIn
      ) : paidIn.stakeRewards === null ? (
        "Not retained"
      ) : (
        <>
          <Amount atoms={paidIn.stakeRewards} /> in cut <CutLink height={paidIn.height} />
        </>
      ),
    ],
  ];
}

/** Execution settles fees. The anchor window determines the subsidy. */
function Reward({ reward }: { reward: BlockReward }) {
  if (reward.subsidy === null) {
    return (
      <>
        <Amount atoms={reward.fees} /> in fees, subsidy when the anchor closes
      </>
    );
  }
  const payable = reward.payable_from_height;
  return (
    <>
      <Amount atoms={BigInt(reward.fees) + BigInt(reward.subsidy)} />
      {reward.state === "paid" ? ", paid" : payable === null ? ", waiting" : <>, payable from cut <CutLink height={payable} /></>}
    </>
  );
}
