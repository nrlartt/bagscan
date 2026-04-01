"use client";

import { Bot, Cpu, Radar, Sparkles } from "lucide-react";

const BUILD_STEPS = [
    "Grounding every answer in official BAGS data",
    "Hardening token and creator resolution",
    "Shaping a cleaner conversational interface",
];

export function TalkToBagsComingSoon() {
    return (
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <section className="crt-panel relative overflow-hidden px-6 py-10 sm:px-8 sm:py-12">
                <div className="absolute inset-0 animate-bg-aurora bg-[radial-gradient(circle_at_top_left,rgba(0,255,65,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(0,170,255,0.10),transparent_24%),radial-gradient(circle_at_bottom_center,rgba(255,170,0,0.08),transparent_32%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,255,65,0.04),transparent_28%,rgba(0,255,65,0.03))]" />

                <div className="relative z-[1] grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
                    <div className="space-y-6">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 border border-[#ffaa00]/30 bg-[#ffaa00]/8 px-3 py-1 text-[10px] tracking-[0.22em] text-[#ffd37a] shadow-[0_0_18px_rgba(255,170,0,0.08)]">
                                <Sparkles className="h-3.5 w-3.5" />
                                COMING SOON
                            </span>
                            <span className="inline-flex items-center gap-2 border border-[#00ff41]/20 bg-[#00ff41]/6 px-3 py-1 text-[10px] tracking-[0.22em] text-[#9dffb8]">
                                <Cpu className="h-3.5 w-3.5" />
                                PRIVATE BUILD
                            </span>
                        </div>

                        <div>
                            <p className="text-[11px] uppercase tracking-[0.34em] text-[#00ff41]/58">Live Thread</p>
                            <h1
                                className="mt-4 text-4xl tracking-[0.18em] text-[#ebfff1] sm:text-6xl"
                                style={{ textShadow: "0 0 18px rgba(0,255,65,0.18), 0 0 38px rgba(0,170,255,0.08)" }}
                            >
                                TALK TO BAGS
                            </h1>
                            <p className="mt-5 max-w-3xl text-sm leading-7 text-[#d8ffe6]/74 sm:text-[15px]">
                                We are polishing the official BAGS copilot behind the scenes. The public surface stays closed for now while we
                                strengthen data grounding, token resolution, and the chat experience.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 stagger-children">
                            {BUILD_STEPS.map((step) => (
                                <div
                                    key={step}
                                    className="glass-card-static relative overflow-hidden border border-[#00ff41]/16 bg-black/45 p-4"
                                >
                                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00ff41]/70 to-transparent animate-pulse-glow" />
                                    <div className="flex items-start gap-3">
                                        <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center border border-[#00ff41]/20 bg-[#00ff41]/8 text-[#9dffb8]">
                                            <Bot className="h-3.5 w-3.5" />
                                        </span>
                                        <p className="text-xs leading-6 tracking-[0.08em] text-[#d8ffe6]/72">{step}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative mx-auto flex w-full max-w-[340px] items-center justify-center">
                        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(0,255,65,0.16),transparent_58%)] blur-2xl animate-pulse-glow" />
                        <div className="relative flex h-[300px] w-[300px] items-center justify-center">
                            <div className="absolute h-[280px] w-[280px] rounded-full border border-[#00ff41]/14 animate-spin-slow" />
                            <div className="absolute h-[220px] w-[220px] rounded-full border border-dashed border-[#00aaff]/18 animate-spin-slow [animation-direction:reverse] [animation-duration:11s]" />
                            <div className="absolute h-[160px] w-[160px] rounded-full border border-[#ffaa00]/20 animate-pulse-glow" />
                            <div className="absolute inset-x-10 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-[#00ff41]/80 to-transparent" />
                            <div className="absolute inset-y-10 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#00aaff]/60 to-transparent" />
                            <div className="absolute h-[92px] w-[92px] rounded-full border border-[#00ff41]/28 bg-black/70 shadow-[0_0_28px_rgba(0,255,65,0.18)]" />
                            <div className="absolute flex h-[92px] w-[92px] items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(0,255,65,0.28),rgba(0,0,0,0.22)_62%,transparent_76%)] animate-float">
                                <Radar className="h-8 w-8 text-[#9dffb8]" />
                            </div>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 border border-[#00ff41]/18 bg-black/70 px-3 py-1 text-[10px] tracking-[0.24em] text-[#9dffb8] shadow-[0_0_18px_rgba(0,255,65,0.08)]">
                                SYNCHRONIZING
                                <span className="ml-1 inline-block w-2 animate-crt-blink">_</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
