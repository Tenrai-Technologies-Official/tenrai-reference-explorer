import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { RewardSettlementNotice } from "../src/components/reward-settlement.ts";

test("cut reward view explains burned totals without implying a wallet payment", () => {
  const html = renderToStaticMarkup(createElement(RewardSettlementNotice));
  assert.match(html, /class="notice"/);
  assert.match(html, /Reward totals include burned amounts/);
  assert.match(html, /Burned and zero-value rewards do not add spendable coins to a wallet/);
});
