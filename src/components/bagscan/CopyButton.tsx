"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { copyToClipboard, cn } from "@/lib/utils";

interface CopyButtonProps {
    value: string;
    label?: string;
    className?: string;
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const ok = await copyToClipboard(value);
        if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <button
            onClick={handleCopy}
            className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 text-[10px] tracking-wider",
                "bg-black/40 hover:bg-[#00ff41]/5 text-[#00ff41]/40 hover:text-[#00ff41]/70",
                "transition-all duration-200 border border-[#00ff41]/10 hover:border-[#00ff41]/25",
                className
            )}
            title={`Copy ${label ?? value}`}
        >
            {label && <span>{label}</span>}
            {copied ? (
                <Check className="w-3 h-3 text-[#00ff41]" />
            ) : (
                <Copy className="w-3 h-3" />
            )}
        </button>
    );
}
