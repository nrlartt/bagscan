import { NextRequest, NextResponse } from "next/server";

const DEAD_WALLETS = [
    "1nc1nerator11111111111111111111111111111111",
    "11111111111111111111111111111111",
];

function getRpcUrl(): string {
    const helius = process.env.HELIUS_API_KEY;
    if (helius) return `https://mainnet.helius-rpc.com/?api-key=${helius}`;
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
    const res = await fetch(getRpcUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
}

interface TokenSupplyResult {
    value: { amount: string; decimals: number; uiAmount: number };
}

interface TokenAccountResult {
    value: Array<{
        account: {
            data: { parsed: { info: { tokenAmount: { uiAmount: number; amount: string } } } };
        };
    }>;
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ mint: string }> }
) {
    const { mint } = await params;

    try {
        const supplyResult = await rpcCall<TokenSupplyResult>("getTokenSupply", [mint]);
        const currentSupply = supplyResult.value.uiAmount;
        const decimals = supplyResult.value.decimals;

        let burnedInDeadWallets = 0;
        const deadWalletChecks = DEAD_WALLETS.map(async (wallet) => {
            try {
                const result = await rpcCall<TokenAccountResult>(
                    "getTokenAccountsByOwner",
                    [
                        wallet,
                        { mint },
                        { encoding: "jsonParsed" },
                    ]
                );
                for (const acc of result.value) {
                    burnedInDeadWallets += acc.account.data.parsed.info.tokenAmount.uiAmount;
                }
            } catch {
                // wallet may not hold this token
            }
        });
        await Promise.all(deadWalletChecks);

        const initialSupply = currentSupply + burnedInDeadWallets;
        const totalBurned = burnedInDeadWallets;
        const burnPct = initialSupply > 0
            ? ((totalBurned / initialSupply) * 100).toFixed(2)
            : "0.00";

        return NextResponse.json({
            success: true,
            data: {
                totalBurned,
                totalSupply: initialSupply,
                circulatingSupply: currentSupply,
                burnPct,
                decimals,
            },
        }, {
            headers: {
                "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
            },
        });
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
