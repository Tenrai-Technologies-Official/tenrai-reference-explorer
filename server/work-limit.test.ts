import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { workLimit } from "./work-limit.ts";

function invoke(handler: RequestHandler, next: NextFunction = () => undefined) {
  const result = { status: 200, body: null as unknown };
  const response = Object.assign(new EventEmitter(), {
    set: () => response,
    status: (status: number) => { result.status = status; return response; },
    json: (body: unknown) => { result.body = body; return response; },
  });
  const settled = Promise.resolve(handler({} as Request, response as unknown as Response, next));
  return { response, result, settled };
}

test("closed callers cannot release unfinished node work or create an unbounded queue", async () => {
  const limit = workLimit();
  const releases: Array<() => void> = [];
  const handler = limit(async () => { await new Promise<void>((resolve) => releases.push(resolve)); });
  const active = Array.from({ length: 128 }, () => invoke(handler));
  assert.equal(releases.length, 128);
  for (const call of active) call.response.emit("close");
  const busy = invoke(handler);
  await busy.settled;
  assert.equal(busy.result.status, 503);
  assert.equal(releases.length, 128, "refused work is never queued or started");
  releases[0]!();
  await active[0]!.settled;
  const replacement = invoke(handler);
  assert.equal(replacement.result.status, 200);
  assert.equal(releases.length, 129);
  assert.equal(invoke(handler).result.status, 503, "one completion frees exactly one permit");
  for (const release of releases) release();
  await Promise.all([...active.map((call) => call.settled), replacement.settled]);
  assert.equal(invoke(limit(() => undefined)).result.status, 200);
});

test("synchronous throws and rejected promises forward the error and release their work permit", async () => {
  const limit = workLimit();
  for (const asynchronous of [false, true]) {
    const failure = new Error("upstream failed");
    const handler = limit(asynchronous ? async () => { throw failure; } : () => { throw failure; });
    for (let i = 0; i < 256; i += 1) {
      let forwarded: unknown;
      const call = invoke(handler, (error?: unknown) => { forwarded = error; });
      await call.settled;
      assert.equal(forwarded, failure);
      assert.equal(call.result.status, 200);
    }
  }
});
