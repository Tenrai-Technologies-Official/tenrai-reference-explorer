import type { RequestHandler } from "express";

const MAX_ACTIVE_WORK = 128;

/** Keep the permit until handler work settles, including after a caller disconnects. */
export function workLimit(): <Params>(handler: RequestHandler<Params>) => RequestHandler<Params> {
  let active = 0;
  return <Params>(handler: RequestHandler<Params>): RequestHandler<Params> => async (req, res, next) => {
    if (active >= MAX_ACTIVE_WORK) {
      res.set("retry-after", "1");
      res.status(503).json({ api_version: 1, code: "unavailable", message: "the explorer is busy, try again shortly", retry_after_millis: 1_000 });
      return;
    }
    active += 1;
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    } finally {
      active -= 1;
    }
  };
}
