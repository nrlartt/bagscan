import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const alt = "BagScan — Bags-native token discovery terminal";
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
                    background: "linear-gradient(135deg, #0b0e11 0%, #0d1512 55%, #0b0e11 100%)",
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
                        color: "#20e3b2",
                    }}
                >
                    <div
                        style={{
                            width: 18,
                            height: 18,
                            borderRadius: 999,
                            background: "#20e3b2",
                        }}
                    />
                    SOLANA · ROBINHOOD CHAIN
                </div>

                <div style={{ marginTop: 28, fontSize: 104, fontWeight: 700, letterSpacing: -2 }}>
                    {SITE_NAME}
                </div>

                <div style={{ marginTop: 20, fontSize: 36, lineHeight: 1.35, color: "rgba(255,255,255,0.62)" }}>
                    Bags-native discovery, bonding-curve tracking, launches and alerts — in one terminal.
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
                    DISCOVER · ALPHA · AGENTS · LAUNCH · PORTFOLIO · ALERTS
                </div>
            </div>
        ),
        size
    );
}
