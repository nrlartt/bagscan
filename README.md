# BagScan

BagScan is a full-stack, Next.js 14+ based web application serving as a highly polished, Bags-native token discovery and launch terminal. It allows users to browse Bags tokens, view robust analytics like fees and claims, instantly generate cross-chain token buy transactions, and launch new tokens with customizable fee-sharing directly integrated with Bags.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS V4
- **Database**: Prisma + SQLite (local development)
- **Wallet**: Solana Wallet Adapter
- **State/Fetching**: TanStack Query
- **Charts**: Recharts

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Generate Prisma Client and apply migrations:
   (This creates your local `dev.db` SQLite database)
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

3. Configure Environment Variables:
   Copy `.env.example` to `.env` if it doesn't exist, and fill in your variables.
   ```bash
   cp .env.example .env
   ```
   **Important Variables:**
   - `DATABASE_URL`: Path to your database.
   - `NEXT_PUBLIC_SOLANA_RPC_URL`: Mainnet beta RPC URL because swap logic requires live connection to Solana.
   - `BAGS_API_KEY`: Required string from your Bags developer account to access /v1 endpoints.
   - `BAGSCAN_ADMIN_SECRET`: Your customized password to access `/partner` dashboard.
   - `BAGSCAN_AGENT_API_KEY`: Shared secret for OpenClaw/SolClaw access to `/api/agent/v1/*`.

4. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## How BagScan Monetizes
BagScan is fully integrated with the Bags **Partner Configuration**. 

1. Within your `.env`, you must provide a `BAGSCAN_PARTNER_WALLET` and a `BAGSCAN_PARTNER_CONFIG`.
2. When any user visits the `/launch` page and creates a Token through BagScan, the UI includes a default-enabled toggle for "BagScan Partner Fee". 
3. If this toggle is on, the BagScan backend automatically injects the exact `BAGSCAN_PARTNER_WALLET` and `BAGSCAN_PARTNER_CONFIG` into the `POST /api/launch/fee-share-config` request proxied to Bags.
4. Bags creates an on-chain fee splitting config including your partner details. Later, as this token trades, fees are attributed to your Partner account.
5. The admin can log in to `/partner` (using `BAGSCAN_ADMIN_SECRET`) to view partner revenue and generate a claim transaction to withdraw claimable partner fees direct to their wallet!

## OpenClaw / SolClaw Integration
BagScan provides a secured agent API under `/api/agent/v1/*` so chat-based agents can quote, prepare swaps, broadcast signed transactions, launch tokens, and read alpha feed data.

Integration guide:
- `docs/OPENCLAW_INTEGRATION.md`
- Hosted skill file for agent bootstrapping: `/skill.md`
- Human-facing setup UI: `/agents`

## Known Limitations
1. **Wallet Ecosystem**: It only natively integrates Solana wallets at this time. Users from other ecosystems must use a compatible Solana wallet (e.g. Phantom, Solflare).
2. **Chart Snapshots Limit**: BagScan does not run a background cron service right now. Chart plotting depends on user-driven read requests ("snapshot on read"). If a token page is not visited for a long time, the chart will have gaps or sparse points. 
3. **Price/Supply Fallbacks**: In cases where Bags does not return standard `totalSupply` or `tokenPrice`, the platform gracefully falls back to displaying 'Unavailable' for FDV, rather than fake math representing incorrect Market Caps.
