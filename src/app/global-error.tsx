"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: replaces the whole document when the root layout itself
 * throws, so users never see a blank white page in production.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[bagscan] global error", error);
    }, [error]);

    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#0b0e11",
                    color: "rgba(255,255,255,0.85)",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    textAlign: "center",
                    padding: "24px",
                }}
            >
                <div>
                    <p style={{ letterSpacing: "0.2em", fontSize: 13, color: "#20e3b2" }}>BAGSCAN</p>
                    <h1 style={{ margin: "12px 0 8px", fontSize: 20, fontWeight: 600 }}>
                        The terminal failed to start
                    </h1>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", maxWidth: 380 }}>
                        An unexpected error broke the app shell. Reload to try again.
                        {error.digest ? ` (ref ${error.digest})` : ""}
                    </p>
                    <button
                        type="button"
                        onClick={reset}
                        style={{
                            marginTop: 20,
                            padding: "10px 18px",
                            border: "none",
                            borderRadius: 12,
                            background: "#20e3b2",
                            color: "#000",
                            fontSize: 11,
                            letterSpacing: "0.16em",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        RELOAD
                    </button>
                </div>
            </body>
        </html>
    );
}
