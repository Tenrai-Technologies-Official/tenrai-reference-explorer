import type { CutList } from "@tenrai/sdk";
import { useApi } from "../api.ts";
import { CutTable } from "../components/lists.tsx";
import { Pending, Title } from "../components/page.tsx";
import { useLive } from "../live.tsx";
import { Link, usePlace } from "../router.tsx";

export function Cuts() {
  const { query } = usePlace();
  const { tick } = useLive();
  const before = /^\d{1,15}$/.test(query.get("before") ?? "") ? query.get("before") : null;
  const { data, error } = useApi<CutList>(before ? `/api/cuts?before=${before}` : "/api/cuts", before ? undefined : tick);

  return (
    <>
      <Title eyebrow="Ledger" title="Finalized cuts" />
      {data ? <CutTable cuts={data.cuts} live={!before} /> : <Pending error={error} />}
      <nav className="pager" aria-label="Pages">
        {before && (
          <Link className="page-button" to="/cuts">
            Newest
          </Link>
        )}
        {data?.next_before != null && (
          <Link className="page-button" to={`/cuts?before=${data.next_before}`}>
            Older
          </Link>
        )}
      </nav>
    </>
  );
}
