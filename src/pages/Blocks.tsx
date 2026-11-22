import { PAGE_ROWS, type RecentBlocks } from "../../shared/api.ts";
import { useApi } from "../api.ts";
import { BlockTable } from "../components/lists.tsx";
import { Pager, Pending, Title, pageOf } from "../components/page.tsx";
import { useLive } from "../live.tsx";
import { usePlace } from "../router.tsx";

export function Blocks() {
  const { query } = usePlace();
  const { tick } = useLive();
  const page = pageOf(query);
  const { data, error } = useApi<RecentBlocks>(`/api/blocks?page=${page}`, page === 1 ? tick : undefined);
  return (
    <>
      <Title eyebrow="Work" title="Latest blocks" />
      {data ? <BlockTable blocks={data.blocks} live={page === 1} limit={PAGE_ROWS} /> : <Pending error={error} />}
      <Pager path="/blocks" page={page} older={data?.older ?? false} />
    </>
  );
}
