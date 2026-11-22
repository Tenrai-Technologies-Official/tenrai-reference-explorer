import { TenraiApiError, TenraiNetworkError, TenraiTimeoutError } from "@tenrai/sdk";
import type { ErrorRequestHandler } from "express";

/** Return errors in the node API format. */
export const sendError: ErrorRequestHandler = (error, _req, res, _next) => {
  const [status, code, message] = describe(error);
  if (status === 500) {
    console.error(error);
  }
  const retry = error instanceof TenraiApiError ? (error.retryAfterMillis ?? null) : null;
  const reason = error instanceof TenraiApiError ? error.reason : undefined;
  res.status(status).json({ api_version: 1, code, message, reason, retry_after_millis: retry });
};

function describe(error: unknown): [number, string, string] {
  if (error instanceof TenraiApiError) {
    return [error.status, error.code, error.message];
  }
  if (error instanceof TenraiTimeoutError) {
    return [504, "unavailable", "the node did not answer in time"];
  }
  if (error instanceof TenraiNetworkError) {
    return [502, "unavailable", "the node is not reachable"];
  }
  if (error instanceof TypeError || error instanceof RangeError) {
    return [400, "invalid_request", error.message];
  }
  return [500, "internal", "the explorer could not answer"];
}
