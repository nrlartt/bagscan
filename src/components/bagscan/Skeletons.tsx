import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
    className?: string;
    count?: number;
}

export function LoadingSkeleton({ className, count = 1 }: LoadingSkeletonProps) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className={cn("animate-pulse border border-[#00ff41]/10 bg-[#00ff41]/[0.02]", className)} />
            ))}
        </>
    );
}

export function TokenCardSkeleton() {
    return (
        <div className="border border-[#00ff41]/10 bg-black/60 p-4 animate-pulse">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 border border-[#00ff41]/10 bg-[#00ff41]/[0.02]" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 bg-[#00ff41]/5 w-24" />
                    <div className="h-2 bg-[#00ff41]/[0.03] w-16" />
                </div>
                <div className="h-4 w-12 bg-[#00ff41]/[0.03]" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="h-12 border border-[#00ff41]/5 bg-[#00ff41]/[0.02]" />
                <div className="h-12 border border-[#00ff41]/5 bg-[#00ff41]/[0.02]" />
            </div>
            <div className="mt-3 flex justify-between">
                <div className="h-2 bg-[#00ff41]/[0.03] w-20" />
                <div className="h-2 bg-[#00ff41]/[0.03] w-14" />
            </div>
        </div>
    );
}

export function TokenTableSkeleton() {
    return (
        <div className="border border-[#00ff41]/15 bg-black/60 overflow-hidden">
            <div className="h-10 bg-[#00ff41]/[0.03] border-b border-[#00ff41]/10" />
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 border-b border-[#00ff41]/5 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="flex items-center h-full px-3 gap-4">
                        <div className="w-8 h-8 border border-[#00ff41]/5 bg-[#00ff41]/[0.02]" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-[#00ff41]/5 w-24" />
                            <div className="h-2 bg-[#00ff41]/[0.02] w-16" />
                        </div>
                        <div className="h-3 bg-[#00ff41]/[0.03] w-16" />
                        <div className="h-3 bg-[#00ff41]/[0.03] w-12 hidden md:block" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function DetailSkeleton() {
    return (
        <div className="space-y-6">
            <div className="h-5 w-32 bg-[#00ff41]/5 animate-pulse" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="h-36 border border-[#00ff41]/10 bg-[#00ff41]/[0.02] animate-pulse" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-24 border border-[#00ff41]/10 bg-[#00ff41]/[0.02] animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                        ))}
                    </div>
                    <div className="h-56 border border-[#00ff41]/10 bg-[#00ff41]/[0.02] animate-pulse" />
                </div>
                <div className="space-y-6">
                    <div className="h-48 border border-[#00ff41]/10 bg-[#00ff41]/[0.02] animate-pulse" />
                    <div className="h-40 border border-[#00ff41]/10 bg-[#00ff41]/[0.02] animate-pulse" style={{ animationDelay: "200ms" }} />
                </div>
            </div>
        </div>
    );
}
