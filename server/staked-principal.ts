import type { TenraiClient } from "@tenrai/sdk";

const MAX_PAGES = 5;
const PAGE_ROWS = 100;
const MAX_AMOUNT = (1n << 128n) - 1n;
const AMOUNT = /^(?:0|[1-9][0-9]{0,38})$/;
type Staking = Pick<TenraiClient["staking"], "positions">;

/** Only a complete scan at one finalized height can supply the address total. */
export async function stakedPrincipal(staking: Staking, address: string): Promise<string | null> {
  try {
    let total = 0n;
    let cursor: string | undefined;
    let finalized: number | undefined;
    const positions = new Set<string>();
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const list = await staking.positions([address], { cursor, limit: PAGE_ROWS });
      if (list.positions.length > PAGE_ROWS || (finalized !== undefined && list.finalized_height !== finalized)) return null;
      finalized = list.finalized_height;
      for (const position of list.positions) {
        if (positions.has(position.position_id)) return null;
        positions.add(position.position_id);
        if (position.owner_address === address && (position.state === "bonded" || position.state === "exit_requested")) {
          if (!AMOUNT.test(position.principal)) return null;
          const principal = BigInt(position.principal);
          if (principal > MAX_AMOUNT || total > MAX_AMOUNT - principal) return null;
          total += principal;
        }
      }
      if (list.next_cursor === null) return total.toString();
      if (list.positions.length === 0) return null;
      cursor = list.next_cursor;
    }
    return null;
  } catch {
    return null;
  }
}
