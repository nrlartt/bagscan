# OpenClaw / SolClaw Integration (BagScan Agent API)

BagScan now exposes a secured Agent API layer for chat-based agents.

## Hosted Skill File

Use this file as the first instruction for agent bootstrapping:

- `/skill.md` (served by BagScan as `https://<your-domain>/skill.md`)

## Authentication

Set `BAGSCAN_AGENT_API_KEY` on BagScan server.

Agent requests must include one of:

- `x-agent-key: <BAGSCAN_AGENT_API_KEY>`
- `Authorization: Bearer <BAGSCAN_AGENT_API_KEY>`

## Base Path

`/api/agent/v1`

## Endpoints

### `GET /health`

Returns status and enabled capabilities.

### `POST /bags/quote`

Body:

```json
{
  "outputMint": "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS",
  "inputMint": "So11111111111111111111111111111111111111112",
  "amount": 100000000,
  "slippageBps": 100
}
```

`amount` should be in base units (for SOL/WSOL, lamports).

### `POST /bags/swap`

Creates an unsigned swap transaction.

Body:

```json
{
  "quoteResponse": { "requestId": "from-quote-response" },
  "userPublicKey": "YourWalletPubkey",
  "outputMint": "BZwugyYF9Nr2x9t433UHnqJ3htQAxFF8YxUHhF2qBAGS",
  "inputMint": "So11111111111111111111111111111111111111112",
  "amount": 100000000
}
```

### `POST /rpc/send-transaction`

Broadcast a signed base64 transaction with RPC fallback.

Body:

```json
{
  "signedTransaction": "base64-serialized-signed-transaction"
}
```

### `POST /launch/create-token-info`

URL-based metadata creation flow for agent usage.

Body:

```json
{
  "name": "My Token",
  "symbol": "MYT",
  "description": "Token launched via OpenClaw",
  "imageUrl": "https://example.com/my-token.png",
  "website": "https://example.com",
  "twitter": "https://x.com/example",
  "telegram": "https://t.me/example"
}
```

### `POST /launch/create`

Create launch transaction on Bags.

Body:

```json
{
  "ipfs": "ipfs://...",
  "tokenMint": "MintAddress",
  "wallet": "WalletPubkey",
  "initialBuyLamports": 0,
  "configKey": "FeeShareConfigPubkey"
}
```

### `GET /alpha/feed`

Returns BagScan alpha feed + radar data for agent reasoning.

## Suggested SolClaw Flow

1. Call `/bags/quote` to estimate.
2. Call `/bags/swap` to get unsigned tx.
3. Sign tx with wallet provider (local keypair, Crossmint, or your signer service).
4. Call `/rpc/send-transaction` to broadcast.
5. Track signature status via explorer.
