"use client";

import { useState } from "react";
import { Lock } from "lucide-react";

interface SecretGateProps {
    children: React.ReactNode;
    onAuthenticate: (secret: string) => void;
    authenticated: boolean;
}

export function SecretGate({
    children,
    onAuthenticate,
    authenticated,
}: SecretGateProps) {
    const [secret, setSecret] = useState("");
    const [error, setError] = useState(false);

    if (authenticated) return <>{children}</>;

    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="w-full max-w-sm space-y-4 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                    <Lock className="w-5 h-5 text-gray-500" />
                </div>
                <h2 className="text-lg font-semibold text-gray-200">Admin Access</h2>
                <p className="text-sm text-gray-500">
                    Enter your admin secret to access the partner dashboard.
                </p>
                <div className="space-y-3">
                    <input
                        type="password"
                        value={secret}
                        onChange={(e) => {
                            setSecret(e.target.value);
                            setError(false);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") onAuthenticate(secret);
                        }}
                        placeholder="Admin secret..."
                        className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]
                       text-sm text-gray-200 placeholder-gray-600
                       focus:outline-none focus:ring-1 focus:ring-purple-500/40"
                    />
                    {error && (
                        <p className="text-xs text-red-400">Invalid secret.</p>
                    )}
                    <button
                        onClick={() => onAuthenticate(secret)}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600
                       text-white text-sm font-medium
                       hover:from-purple-500 hover:to-pink-500 transition-all duration-300"
                    >
                        Authenticate
                    </button>
                </div>
            </div>
        </div>
    );
}
