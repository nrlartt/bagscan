import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Agents - BagScan",
    description: "Agents module is coming soon.",
};

export default function AgentsPage() {
    return (
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <section className="crt-panel flex min-h-[60vh] items-center justify-center p-6">
                <h1
                    className="text-center text-5xl tracking-[0.2em] text-crt sm:text-7xl"
                    style={{ textShadow: "0 0 18px rgba(0,255,65,0.35)" }}
                >
                    COMING SOON
                </h1>
            </section>
        </div>
    );
}
