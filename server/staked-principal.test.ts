import assert from "node:assert/strict";
import test from "node:test";
import type { StakePositionList, StakePositionView } from "@tenrai/sdk";
import { stakedPrincipal } from "./staked-principal.ts";

const owner = "owner";
type Staking = Parameters<typeof stakedPrincipal>[0];
function position(id: number, principal: string, state = "bonded", address = owner): StakePositionView {
  return { position_id: id.toString(16).padStart(96, "0"), principal, state, owner_address: address } as StakePositionView;
}
function page(positions: StakePositionView[], next: string | null = null, height = 7): StakePositionList {
  return { api_version: 1, finalized_height: height, positions, next_cursor: next };
}
function source(pages: StakePositionList[]) {
  const calls: unknown[][] = [];
  const staking = { positions: async (...args: unknown[]) => {
    calls.push(args);
    const result = pages[calls.length - 1];
    if (!result) throw new Error("unexpected extra page");
    return result;
  } } as Staking;
  return { calls, staking };
}

test("a complete fixed-height scan sums owned bonded and exiting amounts exactly", async () => {
  const read = source([
    page([position(1, "9007199254740993"), position(2, "3", "unbonding"), position(3, "99", "bonded", "another")], "next"),
    page([position(4, "7", "exit_requested")]),
  ]);
  assert.equal(await stakedPrincipal(read.staking, owner), "9007199254741000");
  assert.deepEqual(read.calls, [[[owner], { cursor: undefined, limit: 100 }], [[owner], { cursor: "next", limit: 100 }]]);
  assert.equal(await stakedPrincipal(source([page([])]).staking, owner), "0");
});

test("a bounded prefix is unavailable and never reported as a complete total", async () => {
  const read = source(Array.from({ length: 6 }, (_, i) => page([position(i, "10")], `cursor${i}`)));
  assert.equal(await stakedPrincipal(read.staking, owner), null);
  assert.equal(read.calls.length, 5);
});

test("mixed snapshots, duplicate positions and empty continuations cannot manufacture totals", async () => {
  for (const pages of [
    [page([position(1, "10")], "next"), page([position(2, "10")], null, 8)],
    [page([position(1, "10")], "next"), page([position(1, "10")])],
    [page([], "next")],
  ]) assert.equal(await stakedPrincipal(source(pages).staking, owner), null);
});

test("invalid, overflowing and unavailable principal is not turned into a balance", async () => {
  const max = (1n << 128n) - 1n;
  for (const positions of [
    [position(1, "-1")], [position(1, "01")], [position(1, (max + 1n).toString())],
    [position(1, max.toString()), position(2, "1")],
  ]) assert.equal(await stakedPrincipal(source([page(positions)]).staking, owner), null);
  assert.equal(await stakedPrincipal(source([]).staking, owner), null);
});
