"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface CopyButtonProps {
    text?: string;
    value?: string;
    label?: string;
}

export function CopyButton({ text, value, label }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);
    const copyText = text ?? value ?? "";

    const handleCopy = () => {
        navigator.clipboard?.writeText(copyText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (label) {
        return (
            <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-2 py-1 border border-[#00ff41]/15 text-[10px] text-[#00ff41]/40 tracking-wider hover:text-[#00ff41] hover:border-[#00ff41]/40 transition-colors"
                title={`Copy: ${copyText}`}
            >
                {copied ? <Check className="w-3 h-3 text-[#00ff41]" /> : <Copy className="w-3 h-3" />}
                {label}
            </button>
        );
    }

    return (
        <button
            onClick={handleCopy}
            className="flex-shrink-0 p-1.5 border border-[#00ff41]/15 text-[#00ff41]/30 hover:text-[#00ff41] hover:border-[#00ff41]/40 transition-colors"
            title="Copy"
        >
            {copied ? <Check className="w-3 h-3 text-[#00ff41]" /> : <Copy className="w-3 h-3" />}
        </button>
    );
}
