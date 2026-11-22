import type { TenraiClient } from "@tenrai/sdk";
import type { Request, Response } from "express";
import { clientKey } from "./limit.ts";

const KEEPALIVE_MILLIS = 25_000;
const MAX_PAGES = 2_048;
const PAGES_PER_CLIENT = 16;
// Disconnect clients that accumulate too much unsent data.
const MAX_UNREAD_BYTES = 64 * 1024;

/** Fan out one upstream cut stream to the open browser sessions. */
export class LiveCuts {
  readonly #pages = new Set<Response>();
  readonly #clients = new Map<string, number>();

  constructor(tenrai: TenraiClient) {
    const events = tenrai.events();
    events.on("cut", ({ cut }) => {
      this.#send(`event: cut\ndata: ${JSON.stringify({ height: cut.height })}\n\n`);
    });
    events.on("error", (error) => console.warn(`cut stream: ${error.message}`));
    setInterval(() => this.#send(": keepalive\n\n"), KEEPALIVE_MILLIS).unref();
  }

  follow(req: Request, res: Response): void {
    const client = clientKey(req.ip ?? "");
    const open = this.#clients.get(client) ?? 0;
    if (this.#pages.size >= MAX_PAGES || open >= PAGES_PER_CLIENT) {
      res.set("retry-after", "10");
      res.status(503).json({ api_version: 1, code: "unavailable", message: "too many live pages are open, try again shortly", retry_after_millis: 10_000 });
      return;
    }
    this.#clients.set(client, open + 1);
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    });
    res.write(": open\n\n");
    this.#pages.add(res);
    req.on("close", () => {
      this.#pages.delete(res);
      const left = (this.#clients.get(client) ?? 1) - 1;
      if (left > 0) {
        this.#clients.set(client, left);
      } else {
        this.#clients.delete(client);
      }
    });
  }

  #send(frame: string): void {
    for (const page of this.#pages) {
      if (page.writableLength > MAX_UNREAD_BYTES) {
        page.destroy();
        continue;
      }
      page.write(frame);
    }
  }
}
