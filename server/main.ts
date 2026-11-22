import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TenraiClient } from "@tenrai/sdk";
import express, { type RequestHandler } from "express";
import { explorerApi } from "./api.ts";
import { readConfig } from "./config.ts";
import { sendError } from "./errors.ts";
import { requestLimit } from "./limit.ts";
import { LiveCuts } from "./live.ts";

const config = readConfig();
const tenrai = new TenraiClient({ url: config.tenraiUrl, target: config.tenraiTarget });

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
if (!config.dev && !existsSync(join(dist, "index.html"))) {
  const vite = await import("vite").catch(() => {
    throw new Error("dist/ is missing. Run npm ci and npm run build before npm start.");
  });
  console.log("Building the pages into dist/ once");
  await vite.build({ root: fileURLToPath(new URL("../", import.meta.url)), logLevel: "warn" });
}

const app = express();
const server = createServer(app);
// Keep connections open longer than the proxy's idle timeout.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
app.disable("x-powered-by");
// Trust forwarding headers from a local reverse proxy.
app.set("trust proxy", "loopback");
if (!config.dev) {
  app.use(securityHeaders());
}
const limit = requestLimit(config.rateLimit);
// Live connections have separate limits in LiveCuts.
app.use("/api", (req, res, next) => (req.path === "/live" ? next() : limit(req, res, next)));
app.use("/api", explorerApi(tenrai, new LiveCuts(tenrai)), sendError);

if (config.dev) {
  const vite = await import("vite");
  const frontend = await vite.createServer({ server: { middlewareMode: true, hmr: { server } }, appType: "spa" });
  app.use(frontend.middlewares);
} else {
  app.use("/assets", express.static(join(dist, "assets"), { immutable: true, maxAge: "1y", index: false, fallthrough: false }));
  app.use(express.static(dist, { index: false }));
  app.get("/{*page}", (_req, res) => res.sendFile(join(dist, "index.html")));
}

server.listen(config.port, config.host, () => {
  console.log(`Tenrai explorer on http://${config.host}:${config.port}, reading ${tenrai.url} as ${tenrai.target}`);
});

/** Vite's development scripts require a separate policy. */
function securityHeaders(): RequestHandler {
  const policy = [
    "default-src 'self'",
    "img-src 'self' data:",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "require-trusted-types-for 'script'",
    "trusted-types 'none'",
  ].join("; ");
  return (_req, res, next) => {
    res.set({
      "content-security-policy": policy,
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      "cross-origin-opener-policy": "same-origin",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
    });
    next();
  };
}
