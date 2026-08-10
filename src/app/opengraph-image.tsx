import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const alt = "BagScan — the Robinhood Chain token terminal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Static social card so shared BagScan links render with real branding. */
export default function OpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: "80px",
                    background: "linear-gradient(135deg, #070907 0%, #0c1a0c 55%, #070907 100%)",
                    color: "#ffffff",
                    fontFamily: "monospace",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 18,
                        fontSize: 26,
                        letterSpacing: 6,
                        color: "#00C805",
                    }}
                >
                    <div
                        style={{
                            width: 18,
                            height: 18,
                            borderRadius: 999,
                            background: "#00C805",
                        }}
                    />
                    ROBINHOOD CHAIN · 4663
                </div>

                <div style={{ marginTop: 28, fontSize: 104, fontWeight: 700, letterSpacing: -2 }}>
                    {SITE_NAME}
                </div>

                <div style={{ marginTop: 20, fontSize: 36, lineHeight: 1.35, color: "rgba(255,255,255,0.62)" }}>
                    Bonding-curve discovery, flow intelligence, portfolios, alerts and in-app trading.
                </div>

                <div
                    style={{
                        marginTop: 48,
                        display: "flex",
                        gap: 14,
                        fontSize: 22,
                        letterSpacing: 4,
                        color: "rgba(255,255,255,0.4)",
                    }}
                >
                    DISCOVER · ALPHA · PORTFOLIO · ALERTS · TRADE
                </div>
            </div>
        ),
        size
    );
}
