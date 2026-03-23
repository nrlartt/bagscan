"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import Link from "next/link";
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Check,
    ExternalLink,
    Info,
    Loader2,
    Plus,
    Rocket,
    Trash2,
    Upload,
    Wallet,
    X,
} from "lucide-react";
import { RecentBagscanLaunches } from "@/components/launch/RecentBagscanLaunches";
import { cn, shortenAddress } from "@/lib/utils";

const metadataSchema = z.object({
    name: z.string().min(1, "Name is required").max(64),
    symbol: z.string().min(1, "Symbol is required").max(16),
    description: z.string().min(1, "Description is required").max(1000),
    imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    metadataUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    twitter: z.string().optional(),
    telegram: z.string().optional(),
});

type MetadataForm = z.infer<typeof metadataSchema>;
type LaunchStep = 1 | 2 | 3 | 4;
type TxStatus = "idle" | "creating-info" | "creating-fees" | "creating-launch" | "signing" | "success" | "error";
type Provider = "twitter" | "x" | "github" | "kick" | "instagram" | "tiktok";

interface Claimer {
    recipient: string;
    bps: number;
    resolvedWallet: string | null;
}

interface LookupResult {
    provider: string;
    username: string;
    wallet: string | null;
}

const inputClass =
    "w-full border border-[#00ff41]/15 bg-black/60 px-3 py-2.5 text-xs tracking-wider text-[#00ff41] placeholder-[#00ff41]/15 transition-all focus:border-[#00ff41]/40 focus:outline-none focus:shadow-[0_0_10px_rgba(0,255,65,0.08)]";
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;
const PROVIDERS = new Set<Provider>(["twitter", "x", "github", "kick", "instagram", "tiktok"]);

export default function LaunchPage() {
    const { connected, publicKey, signTransaction } = useWallet();
    const { setVisible } = useWalletModal();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<LaunchStep>(1);
    const [metadata, setMetadata] = useState<MetadataForm | null>(null);
    const [claimers, setClaimers] = useState<Claimer[]>([{ recipient: "", bps: 0, resolvedWallet: null }]);
    const [initialBuyLamports, setInitialBuyLamports] = useState(0);
    const [tipWallet, setTipWallet] = useState("");
    const [tipSol, setTipSol] = useState("");
    const [includePartner, setIncludePartner] = useState(true);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const [tokenMint, setTokenMint] = useState<string | null>(null);
    const [txStatus, setTxStatus] = useState<TxStatus>("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<MetadataForm>({
        resolver: zodResolver(metadataSchema),
        defaultValues: {
            name: "",
            symbol: "",
            description: "",
            imageUrl: "",
            metadataUrl: "",
            website: "",
            twitter: "",
            telegram: "",
        },
    });

    useEffect(() => () => {
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
        }
    }, [imagePreview]);

    const externalClaimers = claimers.filter((claimer) => claimer.recipient.trim());
    const externalBps = externalClaimers.reduce((sum, claimer) => sum + claimer.bps, 0);
    const creatorBps = Math.max(0, 10000 - externalBps);
    const tipLamports = toLamports(tipSol);

    const setClaimerField = useCallback((index: number, field: "recipient" | "bps", value: string) => {
        setClaimers((prev) =>
            prev.map((claimer, currentIndex) =>
                currentIndex !== index
                    ? claimer
                    : field === "recipient"
                        ? { ...claimer, recipient: value, resolvedWallet: null }
                        : { ...claimer, bps: parseInt(value, 10) || 0 }
            )
        );
    }, []);

    const handleImageSelect = useCallback((file: File) => {
        setImageError(null);
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            setImageError("ONLY PNG, JPG, OR WEBP FILES ARE ALLOWED");
            return;
        }
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
            setImageError("FILE TOO LARGE (MAX 15MB)");
            return;
        }
        setImageFile(file);
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
        }
        setImagePreview(URL.createObjectURL(file));
    }, [imagePreview]);

    const removeImage = useCallback(() => {
        setImageFile(null);
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
        }
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, [imagePreview]);

    const onMetadataSubmit = useCallback((data: MetadataForm) => {
        setImageError(null);
        setErrorMsg(null);
        if (!imageFile && !data.imageUrl && !data.metadataUrl) {
            setImageError("ADD AN IMAGE FILE, IMAGE URL, OR METADATA URL BEFORE CONTINUING");
            return;
        }
        setMetadata(data);
        setStep(2);
    }, [imageFile]);

    const resolveClaimers = useCallback(async () => {
        const active = claimers.filter((claimer) => claimer.recipient.trim());
        if (active.some((claimer) => claimer.bps <= 0)) {
            throw new Error("EVERY EXTRA RECIPIENT NEEDS BPS GREATER THAN 0");
        }
        if (active.reduce((sum, claimer) => sum + claimer.bps, 0) > 10000) {
            throw new Error("EXTRA RECIPIENTS CANNOT EXCEED 10,000 BPS");
        }

        const walletByIndex = new Map<number, string>();
        const lookups: Array<{ index: number; provider: Provider; username: string }> = [];

        claimers.forEach((claimer, index) => {
            const parsed = parseRecipient(claimer.recipient);
            if (parsed.kind === "empty") return;
            if (parsed.kind === "invalid") throw new Error(parsed.message);
            if (parsed.kind === "wallet") {
                walletByIndex.set(index, parsed.wallet);
                return;
            }
            lookups.push({ index, provider: parsed.provider, username: parsed.username });
        });

        if (lookups.length > 0) {
            const response = await fetch("/api/launch/resolve-fee-wallets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: lookups.map(({ provider, username }) => ({ provider, username })),
                }),
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || "FAILED TO RESOLVE SOCIAL RECIPIENTS");
            }

            const lookupMap = new Map<string, string | null>();
            for (const item of data.data as LookupResult[]) {
                lookupMap.set(`${item.provider.toLowerCase()}:${item.username.toLowerCase()}`, item.wallet);
            }

            for (const lookup of lookups) {
                const wallet = lookupMap.get(`${lookup.provider}:${lookup.username.toLowerCase()}`);
                if (!wallet) {
                    throw new Error(`NO BAGS WALLET FOUND FOR ${lookup.provider}:${lookup.username}`);
                }
                walletByIndex.set(lookup.index, wallet);
            }
        }

        const resolved = claimers.map((claimer, index) => ({
            ...claimer,
            resolvedWallet: claimer.recipient.trim() ? walletByIndex.get(index) ?? null : null,
        }));
        setClaimers(resolved);
        return resolved;
    }, [claimers]);

    const sendSignedTransaction = useCallback(async (signed: VersionedTransaction) => {
        const response = await fetch("/api/rpc/send-transaction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                signedTransaction: encodeBytesToBase64(signed.serialize()),
            }),
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || "FAILED TO SEND TRANSACTION");
        }
        return data.data.signature as string;
    }, []);

    const executeLaunch = useCallback(async () => {
        if (!connected || !publicKey || !signTransaction || !metadata) {
            setVisible(true);
            return;
        }

        const sanitizedTipWallet = tipWallet.trim();
        if (tipLamports > 0 && !sanitizedTipWallet) {
            setErrorMsg("TIP WALLET IS REQUIRED WHEN TIP AMOUNT IS GREATER THAN 0");
            setTxStatus("error");
            return;
        }

        if (sanitizedTipWallet) {
            try {
                new PublicKey(sanitizedTipWallet);
            } catch {
                setErrorMsg("TIP WALLET MUST BE A VALID SOLANA ADDRESS");
                setTxStatus("error");
                return;
            }
        }

        setTxStatus("creating-info");
        setErrorMsg(null);

        try {
            const resolvedClaimers = await resolveClaimers();
            const wallet = publicKey.toBase58();

            let infoResponse: Response;
            if (imageFile) {
                const form = new FormData();
                form.append("name", metadata.name);
                form.append("symbol", metadata.symbol);
                form.append("description", metadata.description);
                form.append("image", imageFile);
                if (metadata.imageUrl) form.append("imageUrl", metadata.imageUrl);
                if (metadata.metadataUrl) form.append("metadataUrl", metadata.metadataUrl);
                if (metadata.website) form.append("website", metadata.website);
                if (metadata.twitter) form.append("twitter", metadata.twitter);
                if (metadata.telegram) form.append("telegram", metadata.telegram);
                infoResponse = await fetch("/api/launch/create-token-info", { method: "POST", body: form });
            } else {
                infoResponse = await fetch("/api/launch/create-token-info", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(metadata),
                });
            }

            const infoData = await infoResponse.json();
            if (!infoData.success) {
                throw new Error(infoData.error || "FAILED TO CREATE TOKEN INFO");
            }
            setTokenMint(infoData.data.tokenMint);

            setTxStatus("creating-fees");
            const active = resolvedClaimers.filter((claimer) => claimer.recipient.trim());
            const claimersArray = [wallet];
            const basisPointsArray = [10000 - active.reduce((sum, claimer) => sum + claimer.bps, 0)];
            for (const claimer of active) {
                if (!claimer.resolvedWallet) {
                    throw new Error(`MISSING WALLET FOR ${claimer.recipient}`);
                }
                claimersArray.push(claimer.resolvedWallet);
                basisPointsArray.push(claimer.bps);
            }

            const feeResponse = await fetch("/api/launch/fee-share-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    payer: wallet,
                    baseMint: infoData.data.tokenMint,
                    claimersArray,
                    basisPointsArray,
                    includePartner,
                    tipWallet: sanitizedTipWallet || undefined,
                    tipLamports: tipLamports > 0 ? tipLamports : undefined,
                }),
            });
            const feeData = await feeResponse.json();
            if (!feeData.success) {
                throw new Error(feeData.error || "FAILED TO CREATE FEE SHARE CONFIG");
            }

            const configKey = feeData.data.meteoraConfigKey;
            if (!configKey) {
                throw new Error("FEE SHARE CONFIG DID NOT RETURN A CONFIG KEY");
            }

            if (feeData.data.needsCreation) {
                for (const txObject of [...(feeData.data.transactions || []), ...(feeData.data.bundles?.flat() || [])]) {
                    const raw = txObject.transaction || txObject.serializedTransaction;
                    if (!raw) {
                        throw new Error("FEE SHARE CONFIG RETURNED AN EMPTY TRANSACTION");
                    }
                    setTxStatus("signing");
                    const signed = await signTransaction(
                        VersionedTransaction.deserialize(decodeTransactionData(raw))
                    );
                    await sendSignedTransaction(signed);
                }
            }

            setTxStatus("creating-launch");
            const launchResponse = await fetch("/api/launch/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ipfs: infoData.data.tokenMetadata,
                    tokenMint: infoData.data.tokenMint,
                    wallet,
                    initialBuyLamports,
                    configKey,
                    tipWallet: sanitizedTipWallet || undefined,
                    tipLamports: tipLamports > 0 ? tipLamports : undefined,
                    partnerIncluded: includePartner,
                    name: metadata.name,
                    symbol: metadata.symbol,
                    description: metadata.description,
                    imageUrl: metadata.imageUrl || infoData.data.tokenLaunch?.image,
                    website: metadata.website,
                    twitter: metadata.twitter,
                    telegram: metadata.telegram,
                }),
            });
            const launchData = await launchResponse.json();
            if (!launchData.success) {
                throw new Error(launchData.error || "FAILED TO CREATE LAUNCH TRANSACTION");
            }

            const serialized =
                typeof launchData.data === "string"
                    ? launchData.data
                    : launchData.data?.transaction || launchData.data?.serializedTransaction;
            if (!serialized) {
                throw new Error("LAUNCH TRANSACTION RESPONSE DID NOT INCLUDE A TRANSACTION");
            }

            setTxStatus("signing");
            const signedLaunch = await signTransaction(
                VersionedTransaction.deserialize(decodeTransactionData(serialized))
            );
            await sendSignedTransaction(signedLaunch);
            setTxStatus("success");
        } catch (error) {
            setErrorMsg(formatError(error));
            setTxStatus("error");
        }
    }, [
        connected,
        imageFile,
        includePartner,
        initialBuyLamports,
        metadata,
        publicKey,
        resolveClaimers,
        sendSignedTransaction,
        setVisible,
        signTransaction,
        tipLamports,
        tipWallet,
    ]);

    return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border-2 border-[#00ff41]/40" style={{ boxShadow: "0 0 16px rgba(0,255,65,0.1)" }}>
                    <Rocket className="h-6 w-6 text-[#00ff41]" />
                </div>
                <h1 className="text-lg tracking-[0.2em] text-[#00ff41]" style={{ textShadow: "0 0 8px rgba(0,255,65,0.3)" }}>LAUNCH ON BAGS</h1>
                <p className="mt-2 text-[10px] tracking-wider text-[#00ff41]/30">CREATE A TOKEN AND DEPLOY THROUGH BAGSCAN</p>
            </div>

            <div className="mb-8 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                {[1, 2, 3, 4].map((currentStep) => (
                    <div key={currentStep} className="flex items-center gap-1.5 sm:gap-2">
                        <div className={cn("flex h-7 w-7 items-center justify-center border-2 text-[10px] tracking-wider transition-all sm:h-8 sm:w-8", step >= currentStep ? "border-[#00ff41]/60 bg-[#00ff41]/15 text-[#00ff41]" : "border-[#00ff41]/15 bg-black text-[#00ff41]/25")}>
                            {step > currentStep ? <Check className="h-4 w-4" /> : currentStep}
                        </div>
                        {currentStep < 4 && <div className={cn("h-0.5 w-4 sm:w-8", step > currentStep ? "bg-[#00ff41]/40" : "bg-[#00ff41]/10")} />}
                    </div>
                ))}
            </div>

            {step === 1 && (
                <form onSubmit={handleSubmit(onMetadataSubmit)} className="space-y-4">
                    <div className="panel-header">TOKEN METADATA</div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="NAME *" error={errors.name?.message}><input {...register("name")} placeholder="My Token" className={inputClass} /></Field>
                        <Field label="SYMBOL *" error={errors.symbol?.message}><input {...register("symbol")} placeholder="TKN" className={inputClass} /></Field>
                    </div>
                    <Field label="DESCRIPTION *" error={errors.description?.message}>
                        <textarea {...register("description")} rows={3} placeholder="What is this token about?" className={cn(inputClass, "resize-none")} />
                    </Field>

                    <div>
                        <label className="mb-1 block text-[9px] tracking-[0.2em] text-[#00ff41]/25">TOKEN IMAGE</label>
                        {imagePreview ? (
                            <div className="flex flex-col gap-4 border border-[#00ff41]/25 bg-black/60 p-3 sm:flex-row sm:items-center">
                                <div className="relative h-20 w-20 overflow-hidden border border-[#00ff41]/20"><Image src={imagePreview} alt="Preview" fill className="object-cover" unoptimized /></div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[10px] tracking-wider text-[#00ff41]/60">{imageFile?.name}</p>
                                    <p className="mt-1 text-[9px] tracking-wider text-[#00ff41]/25">{imageFile ? `${(imageFile.size / 1024 / 1024).toFixed(2)} MB` : ""}</p>
                                    <p className="mt-1 text-[9px] tracking-wider text-[#00ff41]/40">READY FOR BAGS METADATA CREATION</p>
                                </div>
                                <button type="button" onClick={removeImage} className="p-1.5 text-[#00ff41]/20 transition-colors hover:text-[#ff4400]"><X className="h-4 w-4" /></button>
                            </div>
                        ) : (
                            <div onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) handleImageSelect(file); }} onDragOver={(event) => event.preventDefault()} onClick={() => fileInputRef.current?.click()} className="cursor-pointer border-2 border-dashed border-[#00ff41]/15 bg-black/40 p-6 text-center transition-all hover:border-[#00ff41]/30 hover:bg-[#00ff41]/[0.02]">
                                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleImageSelect(file); }} />
                                <Upload className="mx-auto h-5 w-5 text-[#00ff41]/30" />
                                <p className="mt-2 text-[10px] tracking-wider text-[#00ff41]/40">DRAG, DROP, OR CLICK TO UPLOAD</p>
                                <p className="mt-1 text-[8px] tracking-wider text-[#00ff41]/20">PNG / JPG / WEBP - MAX 15MB</p>
                            </div>
                        )}
                        {imageError && <p className="mt-2 text-[9px] tracking-wider text-[#ff4400]/60">{imageError}</p>}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="IMAGE URL" error={errors.imageUrl?.message}><input {...register("imageUrl")} placeholder="https://example.com/token.png" className={inputClass} /></Field>
                        <Field label="METADATA URL" error={errors.metadataUrl?.message}><input {...register("metadataUrl")} placeholder="https://example.com/metadata.json" className={inputClass} /></Field>
                    </div>

                    <div className="rounded-none border border-[#00aaff]/20 bg-[#00aaff]/5 p-3 text-[10px] tracking-wider text-[#00aaff]/60">
                        <div className="flex items-start gap-2">
                            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <div>
                                <p>USE AN IMAGE FILE, IMAGE URL, OR READY METADATA URL.</p>
                                <p className="mt-1 text-[#00aaff]/35">BAGS WILL USE `metadataUrl` AS-IS WHEN PROVIDED.</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Field label="WEBSITE" error={errors.website?.message}><input {...register("website")} placeholder="https://..." className={inputClass} /></Field>
                        <Field label="TWITTER / X" error={errors.twitter?.message}><input {...register("twitter")} placeholder="@handle or URL" className={inputClass} /></Field>
                        <Field label="TELEGRAM" error={errors.telegram?.message}><input {...register("telegram")} placeholder="@group or URL" className={inputClass} /></Field>
                    </div>

                    <div className="flex justify-end">
                        <button type="submit" className="flex items-center gap-2 border-2 border-[#00ff41]/50 bg-[#00ff41]/10 px-6 py-2.5 text-xs tracking-wider text-[#00ff41] transition-all hover:bg-[#00ff41]/20">
                            NEXT <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </form>
            )}

            {step === 2 && (
                <div className="space-y-4">
                    <div className="panel-header">FEE SHARING</div>
                    <div className="rounded-none border border-[#00aaff]/20 bg-[#00aaff]/5 p-3 text-[10px] tracking-wider text-[#00aaff]/60">
                        <div className="flex items-start gap-2">
                            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <div>
                                <p>CREATOR SHARE IS ADDED AUTOMATICALLY.</p>
                                <p className="mt-1 text-[#00aaff]/35">ADD EXTRA RECIPIENTS AS A WALLET OR `provider:username` LIKE `twitter:bagsdotfm`.</p>
                            </div>
                        </div>
                    </div>

                    {claimers.map((claimer, index) => (
                        <div key={index} className="flex flex-col gap-3 border border-[#00ff41]/10 bg-black/60 p-3 sm:flex-row sm:items-end">
                            <div className="flex-1">
                                <label className="mb-1 block text-[9px] tracking-[0.15em] text-[#00ff41]/25">RECIPIENT {index + 1}</label>
                                <input value={claimer.recipient} onChange={(event) => setClaimerField(index, "recipient", event.target.value)} placeholder="Wallet or provider:username" className={inputClass} />
                                {claimer.resolvedWallet && <p className="mt-1 text-[8px] tracking-wider text-[#00ff41]/25">RESOLVED: {shortenAddress(claimer.resolvedWallet)}</p>}
                            </div>
                            <div className="w-full sm:w-28">
                                <label className="mb-1 block text-[9px] tracking-[0.15em] text-[#00ff41]/25">BPS</label>
                                <input type="number" min="0" max="10000" value={claimer.bps} onChange={(event) => setClaimerField(index, "bps", event.target.value)} className={inputClass} />
                            </div>
                            {claimers.length > 1 && <button onClick={() => setClaimers((prev) => prev.filter((_, currentIndex) => currentIndex !== index))} className="p-2 text-[#00ff41]/20 transition-colors hover:text-[#ff4400]"><Trash2 className="h-4 w-4" /></button>}
                        </div>
                    ))}

                    <button onClick={() => setClaimers((prev) => [...prev, { recipient: "", bps: 0, resolvedWallet: null }])} className="flex w-full items-center justify-center gap-1 border border-dashed border-[#00ff41]/15 py-2 text-[10px] tracking-wider text-[#00ff41]/30 transition-colors hover:border-[#00ff41]/30 hover:text-[#00ff41]/60">
                        <Plus className="h-3 w-3" /> ADD RECIPIENT
                    </button>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <StatBox label="EXTERNAL RECIPIENTS" value={`${externalBps} / 10,000`} note="THESE RECIPIENTS ARE RESOLVED THROUGH BAGS BEFORE LAUNCH." invalid={externalBps > 10000} />
                        <StatBox label="CREATOR SHARE" value={`${creatorBps} BPS`} note="BAGS REQUIRES THE CREATOR SPLIT TO BE EXPLICITLY INCLUDED." />
                    </div>

                    <div className="space-y-3 border border-[#00ff41]/10 bg-black/60 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-[10px] tracking-wider text-[#00ff41]/50">BAGSCAN PARTNER FEE</p>
                                <p className="mt-1 text-[8px] tracking-wider text-[#00ff41]/20">KEEP THIS ENABLED TO INCLUDE THE BAGSCAN PARTNER CONFIG.</p>
                            </div>
                            <button type="button" onClick={() => setIncludePartner((current) => !current)} className={cn("min-w-20 border px-3 py-2 text-[10px] tracking-wider transition-colors", includePartner ? "border-[#00ff41]/40 bg-[#00ff41]/10 text-[#00ff41]" : "border-[#00ff41]/15 bg-black text-[#00ff41]/30")}>
                                {includePartner ? "ENABLED" : "DISABLED"}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="INITIAL BUY (SOL)"><input type="number" min="0" step="0.001" value={initialBuyLamports > 0 ? initialBuyLamports / 1_000_000_000 : ""} onChange={(event) => setInitialBuyLamports(Math.max(0, Math.floor(Number(event.target.value || "0") * 1_000_000_000)))} placeholder="0.01" className={inputClass} /></Field>
                            <Field label="TIP AMOUNT (SOL)"><input type="number" min="0" step="0.000001" value={tipSol} onChange={(event) => setTipSol(event.target.value)} placeholder="0.001" className={inputClass} /></Field>
                        </div>

                        <Field label="TIP WALLET"><input value={tipWallet} onChange={(event) => setTipWallet(event.target.value)} placeholder="Optional Solana wallet for tipLamports" className={inputClass} /></Field>
                    </div>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                        <button onClick={() => { setErrorMsg(null); setTxStatus("idle"); setStep(1); }} className="flex items-center justify-center gap-1 border border-[#00ff41]/15 px-4 py-2 text-[10px] tracking-wider text-[#00ff41]/40 transition-colors hover:text-[#00ff41]">
                            <ArrowLeft className="h-4 w-4" /> BACK
                        </button>
                        <button onClick={async () => { try { setErrorMsg(null); await resolveClaimers(); setStep(3); } catch (error) { setErrorMsg(formatError(error)); setTxStatus("error"); } }} className="flex items-center justify-center gap-2 border-2 border-[#00ff41]/50 bg-[#00ff41]/10 px-6 py-2.5 text-xs tracking-wider text-[#00ff41] transition-all hover:bg-[#00ff41]/20">
                            REVIEW <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {step === 3 && metadata && (
                <div className="space-y-4">
                    <div className="panel-header">REVIEW LAUNCH</div>
                    <div className="crt-panel space-y-3 p-5">
                        <h3 className="text-[9px] tracking-[0.2em] text-[#00ff41]/30">TOKEN METADATA</h3>
                        <ReviewRow label="NAME" value={metadata.name} />
                        <ReviewRow label="SYMBOL" value={metadata.symbol} />
                        <ReviewRow label="DESCRIPTION" value={metadata.description} />
                        {(imagePreview || metadata.imageUrl) ? (
                            <div className="flex flex-col gap-2 border-b border-[#00ff41]/5 py-1.5 sm:flex-row sm:items-start sm:justify-between">
                                <span className="text-[9px] tracking-[0.15em] text-[#00ff41]/25">IMAGE</span>
                                <div className="relative h-16 w-16 overflow-hidden border border-[#00ff41]/20"><Image src={imagePreview || metadata.imageUrl || ""} alt="Token" fill className="object-cover" unoptimized /></div>
                            </div>
                        ) : <ReviewRow label="IMAGE" value="Provided via metadata URL" />}
                        <ReviewRow label="IMAGE URL" value={metadata.imageUrl || "-"} />
                        <ReviewRow label="METADATA URL" value={metadata.metadataUrl || "-"} />
                        <ReviewRow label="WEBSITE" value={metadata.website || "-"} />
                        <ReviewRow label="TWITTER / X" value={metadata.twitter || "-"} />
                        <ReviewRow label="TELEGRAM" value={metadata.telegram || "-"} />
                    </div>

                    <div className="crt-panel space-y-3 p-5">
                        <h3 className="text-[9px] tracking-[0.2em] text-[#00ff41]/30">FEE SHARING</h3>
                        <ReviewRow label="CREATOR SHARE" value={`${creatorBps} BPS`} />
                        {externalClaimers.length === 0
                            ? <ReviewRow label="EXTRA RECIPIENTS" value="NONE" />
                            : externalClaimers.map((claimer, index) => (
                                <ReviewRow key={`${claimer.recipient}-${index}`} label={`RECIPIENT ${index + 1}`} value={`${claimer.recipient} -> ${claimer.resolvedWallet ? shortenAddress(claimer.resolvedWallet) : "UNRESOLVED"} (${claimer.bps} BPS)`} />
                            ))}
                        <ReviewRow label="PARTNER FEE" value={includePartner ? "ENABLED" : "DISABLED"} />
                        <ReviewRow label="INITIAL BUY" value={initialBuyLamports > 0 ? `${(initialBuyLamports / 1_000_000_000).toFixed(4)} SOL` : "NONE"} />
                        <ReviewRow label="TIP" value={tipLamports > 0 ? `${tipSol || "0"} SOL -> ${tipWallet || "MISSING TIP WALLET"}` : "NONE"} />
                    </div>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                        <button onClick={() => { setErrorMsg(null); setTxStatus("idle"); setStep(2); }} className="flex items-center justify-center gap-1 border border-[#00ff41]/15 px-4 py-2 text-[10px] tracking-wider text-[#00ff41]/40 transition-colors hover:text-[#00ff41]">
                            <ArrowLeft className="h-4 w-4" /> BACK
                        </button>
                        <button onClick={() => { setErrorMsg(null); setTxStatus("idle"); setStep(4); }} className="flex items-center justify-center gap-2 border-2 border-[#00ff41]/50 bg-[#00ff41]/10 px-6 py-2.5 text-xs tracking-wider text-[#00ff41] transition-all hover:bg-[#00ff41]/20">
                            LAUNCH <Rocket className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {step === 4 && (
                <div className="space-y-6 text-center">
                    {txStatus === "idle" && (
                        <>
                            <h2 className="text-sm tracking-[0.15em] text-[#00ff41]/70">READY TO LAUNCH</h2>
                            {!connected ? (
                                <button onClick={() => setVisible(true)} className="mx-auto flex w-full items-center justify-center gap-2 border-2 border-[#00ff41]/50 bg-[#00ff41]/10 px-8 py-3 text-xs tracking-wider text-[#00ff41] transition-all hover:bg-[#00ff41]/20 sm:w-auto">
                                    <Wallet className="h-4 w-4" /> CONNECT WALLET AND LAUNCH
                                </button>
                            ) : (
                                <button onClick={executeLaunch} className="mx-auto flex w-full items-center justify-center gap-2 border-2 border-[#00ff41]/50 bg-[#00ff41]/15 px-8 py-3 text-xs tracking-wider text-[#00ff41] transition-all hover:bg-[#00ff41]/25 sm:w-auto">
                                    <Rocket className="h-4 w-4" /> EXECUTE LAUNCH
                                </button>
                            )}
                        </>
                    )}

                    {["creating-info", "creating-fees", "creating-launch", "signing"].includes(txStatus) && (
                        <div className="py-12">
                            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#00ff41]/50" />
                            <p className="text-[10px] tracking-wider text-[#00ff41]/40">
                                {txStatus === "creating-info" && "CREATING TOKEN INFO AND METADATA..."}
                                {txStatus === "creating-fees" && "CREATING FEE SHARE CONFIG..."}
                                {txStatus === "creating-launch" && "CREATING LAUNCH TRANSACTION..."}
                                {txStatus === "signing" && "AWAITING WALLET SIGNATURE..."}
                            </p>
                        </div>
                    )}

                    {txStatus === "success" && (
                        <div className="space-y-4 py-8">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center border-2 border-[#00ff41]/50 bg-[#00ff41]/10"><Check className="h-8 w-8 text-[#00ff41]" /></div>
                            <h2 className="text-sm tracking-[0.2em] text-[#00ff41]">TOKEN LAUNCHED</h2>
                            {tokenMint && (
                                <div className="space-y-2">
                                    <p className="text-[9px] tracking-wider text-[#00ff41]/30">TOKEN MINT</p>
                                    <p className="break-all border border-[#00ff41]/15 bg-black/60 p-2 text-[10px] tracking-wider text-[#00ff41]/60">{tokenMint}</p>
                                    <Link href={`/token/${tokenMint}`} className="mt-2 inline-flex items-center gap-2 border-2 border-[#00ff41]/50 bg-[#00ff41]/10 px-6 py-2.5 text-xs tracking-wider text-[#00ff41] transition-all hover:bg-[#00ff41]/20">
                                        VIEW TOKEN <ExternalLink className="h-4 w-4" />
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}

                    {txStatus === "error" && (
                        <div className="space-y-4 py-8">
                            <AlertCircle className="mx-auto h-12 w-12 text-[#ff4400]/40" />
                            <h2 className="text-sm tracking-[0.15em] text-[#ff4400]/70">LAUNCH FAILED</h2>
                            {errorMsg && <p className="mx-auto max-w-md border border-[#ff4400]/20 bg-[#ff4400]/5 p-3 text-[10px] tracking-wider text-[#ff4400]/50">{errorMsg}</p>}
                            <button onClick={() => { setTxStatus("idle"); setErrorMsg(null); }} className="border border-[#00ff41]/20 px-6 py-2.5 text-[10px] tracking-wider text-[#00ff41]/40 transition-colors hover:text-[#00ff41]">
                                TRY AGAIN
                            </button>
                        </div>
                    )}

                    {txStatus !== "success" && <button onClick={() => setStep(3)} className="text-[10px] tracking-wider text-[#00ff41]/20 transition-colors hover:text-[#00ff41]/50">BACK TO REVIEW</button>}
                </div>
            )}

            {errorMsg && step !== 4 && <div className="mt-4 border border-[#ff4400]/20 bg-[#ff4400]/5 p-3 text-[10px] tracking-wider text-[#ff4400]/55">{errorMsg}</div>}
            <RecentBagscanLaunches />
        </div>
    );
}

function Field({
    label,
    error,
    children,
}: {
    label: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label className="mb-1 block text-[9px] tracking-[0.2em] text-[#00ff41]/25">{label}</label>
            {children}
            {error && <p className="mt-1 text-[9px] tracking-wider text-[#ff4400]/60">{error}</p>}
        </div>
    );
}

function StatBox({
    label,
    value,
    note,
    invalid,
}: {
    label: string;
    value: string;
    note: string;
    invalid?: boolean;
}) {
    return (
        <div className="border border-[#00ff41]/10 bg-black/60 p-3">
            <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-wider text-[#00ff41]/30">{label}</span>
                <span className={cn("text-xs tracking-wider", invalid ? "text-[#ff4400]" : "text-[#00ff41]")}>{value}</span>
            </div>
            <p className="mt-1 text-[8px] tracking-wider text-[#00ff41]/20">{note}</p>
        </div>
    );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1 border-b border-[#00ff41]/5 py-1.5 last:border-0 sm:flex-row sm:items-start sm:justify-between">
            <span className="flex-shrink-0 text-[9px] tracking-[0.15em] text-[#00ff41]/25">{label}</span>
            <span className="break-all text-left text-[10px] tracking-wider text-[#00ff41]/50 sm:ml-4 sm:text-right">{value}</span>
        </div>
    );
}

function parseRecipient(rawValue: string):
    | { kind: "empty" }
    | { kind: "wallet"; wallet: string }
    | { kind: "lookup"; provider: Provider; username: string }
    | { kind: "invalid"; message: string } {
    const value = rawValue.trim();
    if (!value) {
        return { kind: "empty" };
    }

    const separatorIndex = value.indexOf(":");
    if (separatorIndex > 0) {
        const provider = value.slice(0, separatorIndex).trim().toLowerCase();
        const username = value.slice(separatorIndex + 1).trim().replace(/^@/, "");

        if (!PROVIDERS.has(provider as Provider)) {
            return {
                kind: "invalid",
                message: `UNSUPPORTED PROVIDER "${provider}". USE twitter, x, github, kick, instagram, OR tiktok.`,
            };
        }

        if (!username) {
            return {
                kind: "invalid",
                message: `MISSING USERNAME FOR ${provider} RECIPIENT`,
            };
        }

        return {
            kind: "lookup",
            provider: provider as Provider,
            username,
        };
    }

    try {
        return { kind: "wallet", wallet: new PublicKey(value).toBase58() };
    } catch {
        return {
            kind: "invalid",
            message: `INVALID RECIPIENT "${value}". USE A SOLANA WALLET OR provider:username.`,
        };
    }
}

function toLamports(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed * 1_000_000_000) : 0;
}

function decodeTransactionData(raw: string) {
    const base64 = tryDecodeBase64(raw);
    if (base64) {
        return base64;
    }

    const base58 = tryDecodeBase58(raw);
    if (base58) {
        return base58;
    }

    throw new Error("UNSUPPORTED TRANSACTION ENCODING RETURNED BY BAGS");
}

function tryDecodeBase64(raw: string) {
    try {
        const bytes = decodeBase64ToBytes(raw);
        VersionedTransaction.deserialize(bytes);
        return bytes;
    } catch {
        return null;
    }
}

function tryDecodeBase58(raw: string) {
    try {
        const bytes = bs58.decode(raw);
        VersionedTransaction.deserialize(bytes);
        return bytes;
    } catch {
        return null;
    }
}

function formatError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function encodeBytesToBase64(bytes: Uint8Array) {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

function decodeBase64ToBytes(raw: string) {
    const normalized = raw.replace(/\s+/g, "");
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}
