import { cn } from "@/lib/utils";

const PROVIDER_COLORS: Record<string, string> = {
    twitter: "bg-[#00aaff]/10 text-[#00aaff]/60 border-[#00aaff]/20",
    x: "bg-[#00aaff]/10 text-[#00aaff]/60 border-[#00aaff]/20",
    telegram: "bg-[#00aaff]/10 text-[#00aaff]/50 border-[#00aaff]/15",
    discord: "bg-[#00aaff]/10 text-[#00aaff]/50 border-[#00aaff]/15",
    farcaster: "bg-[#00ff41]/10 text-[#00ff41]/50 border-[#00ff41]/15",
    tiktok: "bg-[#ff4400]/10 text-[#ff4400]/50 border-[#ff4400]/15",
    kick: "bg-[#00ff41]/10 text-[#00ff41]/50 border-[#00ff41]/15",
    instagram: "bg-[#ff4400]/10 text-[#ff4400]/50 border-[#ff4400]/15",
    github: "bg-[#00ff41]/10 text-[#00ff41]/40 border-[#00ff41]/15",
    moltbook: "bg-[#ffaa00]/10 text-[#ffaa00]/50 border-[#ffaa00]/15",
    google: "bg-[#ff4400]/10 text-[#ff4400]/50 border-[#ff4400]/15",
    solana: "bg-[#00ff41]/10 text-[#00ff41]/60 border-[#00ff41]/20",
    apple: "bg-[#00ff41]/10 text-[#00ff41]/40 border-[#00ff41]/15",
    email: "bg-[#00aaff]/10 text-[#00aaff]/50 border-[#00aaff]/15",
    unknown: "bg-[#00ff41]/5 text-[#00ff41]/25 border-[#00ff41]/10",
    default: "bg-[#00ff41]/5 text-[#00ff41]/30 border-[#00ff41]/10",
};

interface ProviderBadgeProps {
    provider?: string;
    username?: string;
    className?: string;
}

export function ProviderBadge({ provider, username, className }: ProviderBadgeProps) {
    if (!provider) return null;

    const key = provider.toLowerCase();
    const colors = PROVIDER_COLORS[key] ?? PROVIDER_COLORS.default;

    return (
        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] border", colors, className)}>
            <span>{provider}</span>
            {username && <span className="opacity-60 normal-case">@{username}</span>}
        </span>
    );
}

interface CreatorBadgeProps {
    isCreator?: boolean;
    isAdmin?: boolean;
    className?: string;
}

export function CreatorBadge({ isCreator, isAdmin, className }: CreatorBadgeProps) {
    if (!isCreator && !isAdmin) return null;

    return (
        <div className={cn("flex items-center gap-1", className)}>
            {isAdmin && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] bg-[#ffaa00]/10 text-[#ffaa00]/60 border border-[#ffaa00]/20 uppercase tracking-[0.1em]">
                    ADMIN
                </span>
            )}
            {isCreator && !isAdmin && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] bg-[#00ff41]/10 text-[#00ff41]/60 border border-[#00ff41]/20 uppercase tracking-[0.1em]">
                    CREATOR
                </span>
            )}
        </div>
    );
}
