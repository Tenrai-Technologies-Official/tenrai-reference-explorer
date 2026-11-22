# Tenrai Reference Explorer

A read-only block explorer for Tenrai. The Node.js server reads a Tenrai node or API through the SDK. The React frontend shows finalized cuts, work blocks, transactions, balances and validators.

## Run

Use Node.js 22.18 or later.

```sh
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:28783`. Use `npm run dev` for local development with hot reload.

The explorer defaults to a local mainnet node on port `28701`. Copy `.env.example` to `.env` to change the configuration. Set `TENRAI_TARGET=api` and `TENRAI_URL` to use a Tenrai API service. `TENRAI_NETWORK` selects the default local port for a network.

For production, use an HTTPS reverse proxy on the same host. Keep the explorer bound to loopback and have the proxy set `X-Forwarded-For` from the client connection. Disable response buffering for `/api/live` so finalized cuts reach browsers as they arrive.

## Transaction history

Compact records can show retained native lock conditions and revealed preimages after pruning. Canonical transaction downloads require the full record.

## Checks

```sh
npm run check
npm test
```

The SDK is pinned in `vendor/tenrai-sdk`. When updating it, use the built npm package, remove its `prepare` hook and refresh the lockfile before running the checks.

## License

Apache-2.0. The bundled fonts use the SIL Open Font License.
