import { NextRequest, NextResponse } from "next/server";

/**
 * Tokenomics API – uses Helius DAS (same source as Solscan) for accurate supply data.
 * Falls back to getTokenSupply RPC if Helius fails.
 */

const DEAD_WALLETS = [
    "1nc1nerator11111111111111111111111111111111",
    "11111111111111111111111111111111",
];

function getRpcUrl(): string {
    const helius = process.env.HELIUS_API_KEY;
    if (helius) return `https://mainnet.helius-rpc.com/?api-key=${helius}`;
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
}

async function heliusRpc(body: object): Promise<unknown> {
    const url = getRpcUrl();
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "tokenomics", ...body }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
}

interface HeliusAsset {
    id?: string;
    token_info?: {
        supply?: number;
        decimals?: number;
        symbol?: string;
    };
}

interface TokenSupplyValue {
    amount: string;
    decimals: number;
    uiAmount: number | null;
    uiAmountString?: string;
}

interface TokenAccountEntry {
    account: {
        data: {
            parsed: {
                info: { tokenAmount: { uiAmount: number | null; amount: string } };
            };
        };
    };
}

function parseSupply(
    rawAmount: string | number,
    decimals: number
): number {
    const str = String(rawAmount);
    const num = Number(str);
    if (Number.isFinite(num) && num >= 0) {
        return num / Math.pow(10, decimals);
    }
    return 0;
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ mint: string }> }
) {
    const { mint } = await params;

    try {
        let totalSupply = 0;
        let decimals = 9;

        // 1) Primary: Helius getAsset (same data source as Solscan)
        try {
            const asset = await heliusRpc({
                method: "getAsset",
                params: { id: mint },
            }) as HeliusAsset | null;

            if (asset?.token_info?.supply != null) {
                decimals = asset.token_info.decimals ?? 9;
                totalSupply = parseSupply(asset.token_info.supply, decimals);
            }
        } catch {
            // fallback below
        }

        // 2) Fallback: getTokenSupply RPC
        if (totalSupply <= 0) {
            const supplyResult = await heliusRpc({
                method: "getTokenSupply",
                params: [mint],
            }) as { value: TokenSupplyValue } | null;

            if (supplyResult?.value) {
                const v = supplyResult.value;
                decimals = v.decimals;
                // uiAmount can be null for large numbers – use uiAmountString or parse amount
                if (v.uiAmount != null && Number.isFinite(v.uiAmount)) {
                    totalSupply = v.uiAmount;
                } else if (typeof v.uiAmountString === "string") {
                    totalSupply = parseFloat(v.uiAmountString) || parseSupply(v.amount, decimals);
                } else {
                    totalSupply = parseSupply(v.amount, decimals);
                }
            }
        }

        // 3) Tokens in dead wallets (sent to burn-like addresses)
        let burnedInDeadWallets = 0;
        for (const wallet of DEAD_WALLETS) {
            try {
                const result = await heliusRpc({
                    method: "getTokenAccountsByOwner",
                    params: [wallet, { mint }, { encoding: "jsonParsed" }],
                }) as { value: TokenAccountEntry[] } | null;

                for (const acc of result?.value ?? []) {
                    const amt = acc.account?.data?.parsed?.info?.tokenAmount;
                    if (amt) {
                        if (amt.uiAmount != null) {
                            burnedInDeadWallets += amt.uiAmount;
                        } else {
                            burnedInDeadWallets += parseSupply(amt.amount, decimals);
                        }
                    }
                }
            } catch {
                // skip
            }
        }

        const circulatingSupply = Math.max(0, totalSupply - burnedInDeadWallets);
        const burnPct =
            totalSupply > 0
                ? ((burnedInDeadWallets / totalSupply) * 100).toFixed(2)
                : "0.00";

        return NextResponse.json(
            {
                success: true,
                data: {
                    totalBurned: burnedInDeadWallets,
                    totalSupply,
                    circulatingSupply,
                    burnPct,
                    decimals,
                },
            },
            {
                headers: {
                    "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
                },
            }
        );
    } catch (err) {
        console.error("[tokenomics]", err);
        return NextResponse.json(
            {
                success: true,
                data: {
                    totalBurned: 0,
                    totalSupply: 0,
                    circulatingSupply: 0,
                    burnPct: "0.00",
                    decimals: 0,
                },
            },
            { status: 200 }
        );
    }
}
