import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { RhLogo } from "@/components/bagscan/RhLogo";
import { RH_CHAIN_ID, RH_EXPLORER_URL, RH_RPC_URLS, RH_THEME } from "@/lib/rh/chain";

export const metadata: Metadata = {
    title: "About",
    description:
        "BagScan is a Robinhood Chain terminal: discovery, flow intelligence, portfolios, alerts and in-app trading on chain 4663.",
    alternates: { canonical: "/about" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-[10px] tracking-[0.18em] text-[#00C805]/70">{title}</h2>
            <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-white/55">{children}</div>
        </section>
    );
}

export default function AboutPage() {
    return (
        <div className="mx-auto w-full min-w-0 max-w-[900px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
            <div className="mb-5 overflow-hidden rounded-2xl border border-[#00C805]/18 bg-gradient-to-br from-[#0c140c] via-[#0a0f0a] to-[#070907] p-5 sm:p-7">
                <div className="flex items-center gap-2">
                    <RhLogo size={20} />
                    <span className="text-[10px] tracking-[0.2em] text-[#00C805]/70">
                        ROBINHOOD CHAIN · {RH_CHAIN_ID}
                    </span>
                </div>
                <h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                    BagScan is a Robinhood Chain terminal
                </h1>
                <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-white/50">
                    Every surface here targets one network: discovery of live launches, flow intelligence scored from
                    on-chain trades, wallet portfolios with creator fee positions, wallet-signed alerts, and trading
                    that executes from your wallet — on the bonding curve before graduation, and through the Uniswap
                    V4 pool after.
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Section title="DISCOVER">
                    <p>
                        Two lanes — tokens still filling their bonding curve, and tokens that graduated into a Uniswap
                        V4 pool. Prices are quoted in ETH and converted to USD at the live rate.
                    </p>
                    <p>
                        Valuation is always fully diluted: every launch mints a fixed 1B supply, and nothing on this
                        chain reports a circulating market cap, so BagScan labels it FDV rather than implying one.
                    </p>
                </Section>

                <Section title="ALPHA">
                    <p>
                        Signals are computed from indexed trades: curve momentum, volume, buy and sell pressure, whale
                        prints, crowd formation and price swings, scored 0–100.
                    </p>
                    <p>
                        The window is 7 days. Flow on this chain is thin enough that a 24-hour view reads empty most of
                        the time; the 24h slice is kept as a separate &quot;live right now&quot; indicator.
                    </p>
                </Section>

                <Section title="TRADING">
                    <p>
                        Before graduation, buys and sells execute against the token&apos;s bonding curve contract with
                        a slippage bound you set. Sells approve the curve first.
                    </p>
                    <p>
                        After graduation, trades route through the Robinhood UniversalRouter and Uniswap V4 pool.
                        Buys wrap ETH to WETH; sells unwrap proceeds back to native ETH when possible. Quotes cover
                        both phases via on-chain quotes.
                    </p>
                </Section>

                <Section title="ALERTS">
                    <p>
                        Watch any token and get alerted when its curve crosses 25/50/75/90%, when it graduates, on
                        volume spikes, sharp price moves and whale trades.
                    </p>
                    <p>
                        Alerts are tied to your wallet through a signed message — no transaction, no gas. Delivery is
                        in-app, with optional browser push and Telegram.
                    </p>
                </Section>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Section title="NETWORK">
                    <dl className="space-y-2 font-mono text-[11px]">
                        <div className="flex justify-between gap-3">
                            <dt className="text-white/35">Chain ID</dt>
                            <dd className="text-white/70">{RH_CHAIN_ID}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="shrink-0 text-white/35">RPC</dt>
                            <dd className="truncate text-white/70">{RH_RPC_URLS[0]}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="shrink-0 text-white/35">Explorer</dt>
                            <dd className="truncate text-white/70">
                                <a
                                    href={RH_EXPLORER_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-[#00C805]"
                                >
                                    {RH_EXPLORER_URL.replace("https://", "")}
                                </a>
                            </dd>
                        </div>
                    </dl>
                </Section>

                <Section title="DATA">
                    <p>
                        Token, portfolio, trade and quote data is read directly from Robinhood Chain
                        launchpad contracts and event logs. Balances, allowances and every transaction you
                        sign go straight to the chain RPC — nothing is intermediated.
                    </p>
                    <p>
                        Curve trades are built and signed in your browser against the token&apos;s own contract, so
                        BagScan never holds funds or keys.
                    </p>
                </Section>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-semibold tracking-[0.14em] text-black transition-opacity hover:opacity-90"
                    style={{ backgroundColor: RH_THEME.green }}
                >
                    START DISCOVERING
                </Link>
                <a
                    href={RH_EXPLORER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-4 py-2.5 text-[10px] tracking-[0.14em] text-white/55 transition-colors hover:border-[#00C805]/30 hover:text-[#00C805]"
                >
                    CHAIN EXPLORER
                    <ExternalLink className="h-3 w-3" />
                </a>
            </div>
        </div>
    );
}
