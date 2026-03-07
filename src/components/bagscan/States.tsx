import { cn } from "@/lib/utils";
import { SearchX, AlertTriangle } from "lucide-react";

interface EmptyStateProps {
    title?: string;
    description?: string;
    className?: string;
}

export function EmptyState({
    title = "NO DATA FOUND",
    description = "TRY ADJUSTING YOUR FILTERS OR CHECK BACK LATER.",
    className,
}: EmptyStateProps) {
    return (
        <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
            <SearchX className="w-10 h-10 text-[#00ff41]/20 mb-4" />
            <h3 className="text-sm text-[#00ff41]/50 tracking-[0.15em]">{title}</h3>
            <p className="text-[10px] text-[#00ff41]/25 mt-2 max-w-md tracking-wider">{description}</p>
        </div>
    );
}

interface ErrorStateProps {
    title?: string;
    error?: string;
    onRetry?: () => void;
    className?: string;
}

export function ErrorState({
    title = "SYSTEM ERROR",
    error,
    onRetry,
    className,
}: ErrorStateProps) {
    return (
        <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
            <AlertTriangle className="w-10 h-10 text-[#ff4400]/40 mb-4" />
            <h3 className="text-sm text-[#ff4400]/70 tracking-[0.15em]">{title}</h3>
            {error && (
                <details className="mt-2 max-w-lg text-left">
                    <summary className="text-[10px] text-[#00ff41]/25 cursor-pointer tracking-wider">TECHNICAL DETAILS</summary>
                    <pre className="mt-1 text-[10px] text-[#ff4400]/40 bg-black/60 p-2 border border-[#ff4400]/15 overflow-x-auto tracking-wider">{error}</pre>
                </details>
            )}
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="mt-4 px-4 py-2 text-[10px] tracking-wider border border-[#00ff41]/30 text-[#00ff41]/60 hover:text-[#00ff41] hover:bg-[#00ff41]/5 transition-colors"
                >
                    RETRY CONNECTION
                </button>
            )}
        </div>
    );
}
