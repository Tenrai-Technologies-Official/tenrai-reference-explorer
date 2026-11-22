import type { Target } from "@tenrai/sdk";

export interface Config {
  host: string;
  port: number;
  tenraiUrl: string;
  tenraiTarget: Target;
  /** Requests per minute per client. Zero disables the rate limit. */
  rateLimit: number;
  dev: boolean;
}

const PORTS: Record<string, { node: number; api: number }> = {
  mainnet: { node: 28701, api: 28715 },
  testnet: { node: 28706, api: 28716 },
  testnet100: { node: 28706, api: 28716 },
  development: { node: 28711, api: 28717 },
};

export function readConfig(): Config {
  const port = Number(process.env.PORT ?? 28783);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be a port number");
  }
  const target = process.env.TENRAI_TARGET ?? "node";
  if (target !== "api" && target !== "node") {
    throw new Error('TENRAI_TARGET must be "node" or "api"');
  }
  const rateLimit = Number(process.env.TENRAI_RATE_LIMIT ?? 1_200);
  if (!Number.isSafeInteger(rateLimit) || rateLimit < 0) {
    throw new Error("TENRAI_RATE_LIMIT must be a whole number of requests per minute");
  }
  const ports = PORTS[process.env.TENRAI_NETWORK ?? "mainnet"];
  if (!ports) {
    throw new Error('TENRAI_NETWORK must be "mainnet", "testnet", "testnet100" or "development"');
  }
  return {
    host: process.env.HOST ?? "127.0.0.1",
    port,
    tenraiUrl: process.env.TENRAI_URL ?? `http://127.0.0.1:${target === "api" ? ports.api : ports.node}`,
    tenraiTarget: target,
    rateLimit,
    dev: process.argv.includes("--dev"),
  };
}
