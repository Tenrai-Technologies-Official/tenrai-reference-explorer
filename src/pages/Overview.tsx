import { OVERVIEW_ROWS, type Overview as OverviewData } from "../../shared/api.ts";
import { useApi } from "../api.ts";
import { BlockTable, CutTable, TransactionTable } from "../components/lists.tsx";
import { DagArt } from "../components/icons.tsx";
import { Search } from "../components/layout.tsx";
import { Metric, Pending, Section } from "../components/page.tsx";
import { CutLink } from "../components/values.tsx";
import { count, duration, hashRate, number, percent, plural, trai } from "../format.ts";
import { useLive } from "../live.tsx";
import { Link } from "../router.tsx";

export function Overview() {
  const { tick } = useLive();
  const { data, error } = useApi<OverviewData>("/api/overview", tick);
  if (!data) {
    return <Pending error={error} />;
  }
  const { node, rates, mempool, epoch, supply } = data;
  // Use the longest hashrate window to smooth individual blocks.
  const recent = rates.windows.reduce<(typeof rates.windows)[number] | undefined>(
    (longest, window) => (longest === undefined || window.seconds > longest.seconds ? window : longest),
    undefined,
  );

  return (
    <>
      <section className="hero">
        <DagArt />
        <h1>
          Explore the <span className="accent-text">Tenrai</span> blockchain
        </h1>
        <Search hero />
      </section>

      <div className="grid metrics">
        <Metric
          icon="height"
          label="Finalized height"
          value={<CutLink height={node.finalized.height} />}
          note={rates.average_cut_interval_millis === null ? undefined : `a cut every ${duration(rates.average_cut_interval_millis)}`}
        />
        <Metric icon="bolt" label="Network hash rate" value={hashRate(rates.network_hashes_per_second)} />
        <Metric
          icon="block"
          label="Work blocks"
          value={recent ? `${number(recent.received_blocks_per_second)} / s` : "–"}
          note={recent && `over the last ${duration(recent.seconds * 1000)}`}
        />
        <Metric icon="transfer" label="Transactions" value={recent ? `${number(recent.transactions_per_second)} / s` : "–"} />
        <Metric
          icon="inbox"
          label="Mempool"
          value={`${count(mempool.transactions)} waiting`}
          note={`${percent(mempool.mass, mempool.max_mass)} of its mass limit`}
        />
        <Metric icon="cycle" label="Epoch" value={count(epoch.epoch)} note={`${plural(epoch.cuts_remaining, "cut")} to the next`} />
        <Metric icon="shield" label="Active validators" value={count(epoch.active_validators)} note={`${trai(epoch.bonded)} bonded`} />
        <Metric icon="coins" label="Circulating supply" value={trai(supply.circulating_supply)} note={`of ${trai(supply.max_supply)}${BigInt(supply.private_supply) > 0n ? `, ${trai(supply.private_supply)} private` : ""}`} />
      </div>

      <Section title="Latest cuts" action={<Link className="link" to="/cuts">All cuts</Link>}>
        <CutTable cuts={data.cuts} short live />
      </Section>
      <Section title="Latest blocks" action={<Link className="link" to="/blocks">More blocks</Link>}>
        <BlockTable blocks={data.blocks} short live limit={OVERVIEW_ROWS} />
      </Section>

      <Section title="Latest transactions" action={<Link className="link" to="/transactions">More transactions</Link>}>
        <TransactionTable transactions={data.transactions} short live />
      </Section>
    </>
  );
}
