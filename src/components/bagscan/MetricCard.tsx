import { cn } from "@/lib/utils";

interface MetricCardProps {
    label: string;
    value: string;
    subValue?: string;
    tooltip?: string;
    icon?: React.ReactNode;
    className?: string;
}

export function MetricCard({ label, value, subValue, tooltip, icon, className }: MetricCardProps) {
    return (
        <div
            className={cn(
                "relative group border border-[#00ff41]/15 bg-black/70 p-4 transition-all duration-300",
                "hover:border-[#00ff41]/35 hover:bg-[#00ff41]/[0.02]",
                className
            )}
            title={tooltip}
        >
            <div className="relative flex items-start justify-between">
                <div className="space-y-1">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-[#00ff41]/30">{label}</p>
                    <p className="text-lg text-[#00ff41] tracking-wider" style={{ textShadow: '0 0 8px rgba(0,255,65,0.2)' }}>
                        {value}
                    </p>
                    {subValue && <p className="text-[10px] text-[#00ff41]/30 tracking-wider">{subValue}</p>}
                </div>
                {icon && (
                    <div className="text-[#00ff41]/15 group-hover:text-[#00ff41]/30 transition-colors duration-300">
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
}
