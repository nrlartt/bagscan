"use client";

import { useState, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import {
    Rocket, Wallet, Check, Loader2, ArrowRight, ArrowLeft,
    AlertCircle, Info, Plus, Trash2, ExternalLink, Upload, X,
} from "lucide-react";
import { cn, shortenAddress } from "@/lib/utils";
import { RecentBagscanLaunches } from "@/components/launch/RecentBagscanLaunches";

const metadataSchema = z.object({
    name: z.string().min(1, "Name is required").max(64),
    symbol: z.string().min(1, "Symbol is required").max(16),
    description: z.string().min(1, "Description is required").max(1000),
    imageUrl: z.string().optional().or(z.literal("")),
    website: z.string().url("Must be valid URL").optional().or(z.literal("")),
    twitter: z.string().optional(),
    telegram: z.string().optional(),
});

type MetadataForm = z.infer<typeof metadataSchema>;

interface Claimer { wallet: string; bps: number; }
type LaunchStep = 1 | 2 | 3 | 4;

export default function LaunchPage() {
    const { connected, publicKey, signTransaction } = useWallet();
    const { setVisible } = useWalletModal();

    const [step, setStep] = useState<LaunchStep>(1);
    const [metadata, setMetadata] = useState<MetadataForm | null>(null);
    const [claimers, setClaimers] = useState<Claimer[]>([{ wallet: "", bps: 10000 }]);
    const [initialBuyLamports, setInitialBuyLamports] = useState(0);
    const [tokenMint, setTokenMint] = useState<string | null>(null);
    const [txStatus, setTxStatus] = useState<"idle" | "creating-info" | "creating-fees" | "creating-launch" | "signing" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { register, handleSubmit, formState: { errors }, setValue } = useForm<MetadataForm>({
        resolver: zodResolver(metadataSchema),
        defaultValues: { name: "", symbol: "", description: "", imageUrl: "", website: "", twitter: "", telegram: "" },
    });

    const handleImageSelect = useCallback((file: File) => {
        setImageError(null);
        if (!file.type.startsWith("image/")) {
            setImageError("ONLY IMAGE FILES ALLOWED (PNG, JPG, GIF, WEBP)");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setImageError("FILE TOO LARGE (MAX 5MB)");
            return;
        }
        setImageFile(file);
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(URL.createObjectURL(file));
    }, [imagePreview]);

    const removeImage = useCallback(() => {
        setImageFile(null);
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
        setImageError(null);
        setValue("imageUrl", "");
        if (fileInputRef.current) fileInputRef.current.value = "";
    }, [imagePreview, setValue]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleImageSelect(file);
    }, [handleImageSelect]);

    const onMetadataSubmit = useCallback((data: MetadataForm) => {
        setMetadata(data);
        setStep(2);
    }, []);

    const addClaimer = () => setClaimers((prev) => [...prev, { wallet: "", bps: 0 }]);
    const removeClaimer = (idx: number) => setClaimers((prev) => prev.filter((_, i) => i !== idx));
    const updateClaimer = (idx: number, field: "wallet" | "bps", value: string) => {
        setClaimers((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: field === "bps" ? parseInt(value, 10) || 0 : value } : c));
    };
    const totalBps = claimers.reduce((sum, c) => sum + c.bps, 0);

    const sendSignedTransaction = useCallback(async (signed: VersionedTransaction): Promise<string> => {
        const b64 = Buffer.from(signed.serialize()).toString("base64");
        const res = await fetch("/api/rpc/send-transaction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ signedTransaction: b64 }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to send transaction");
        return data.data.signature;
    }, []);

    const executeLaunch = useCallback(async () => {
        if (!connected || !publicKey || !signTransaction || !metadata) { setVisible(true); return; }
        setTxStatus("creating-info"); setErrorMsg(null);

        const walletAddr = publicKey.toBase58();

        try {
            // Step 1: Create token info & metadata
            let infoRes: Response;

            if (imageFile) {
                const formData = new FormData();
                formData.append("name", metadata.name);
                formData.append("symbol", metadata.symbol);
                formData.append("description", metadata.description);
                formData.append("image", imageFile);
                if (metadata.imageUrl) formData.append("imageUrl", metadata.imageUrl);
                if (metadata.website) formData.append("website", metadata.website);
                if (metadata.twitter) formData.append("twitter", metadata.twitter);
                if (metadata.telegram) formData.append("telegram", metadata.telegram);

                infoRes = await fetch("/api/launch/create-token-info", {
                    method: "POST",
                    body: formData,
                });
            } else {
                infoRes = await fetch("/api/launch/create-token-info", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(metadata),
                });
            }
            const infoData = await infoRes.json();
            if (!infoData.success) throw new Error(infoData.error || "Failed to create token info");

            const mint = infoData.data.tokenMint;
            const metadataIpfs = infoData.data.tokenMetadata;
            setTokenMint(mint);

            // Step 2: Create fee share config
            setTxStatus("creating-fees");

            const claimersArray: string[] = [];
            const basisPointsArray: number[] = [];

            const validClaimers = claimers.filter((c) => c.wallet.trim().length > 0);
            if (validClaimers.length > 0) {
                const claimerBpsSum = validClaimers.reduce((s, c) => s + c.bps, 0);
                const creatorBps = 10000 - claimerBpsSum;
                if (creatorBps > 0) {
                    claimersArray.push(walletAddr);
                    basisPointsArray.push(creatorBps);
                }
                for (const c of validClaimers) {
                    claimersArray.push(c.wallet.trim());
                    basisPointsArray.push(c.bps);
                }
            } else {
                claimersArray.push(walletAddr);
                basisPointsArray.push(10000);
            }

            const feeRes = await fetch("/api/launch/fee-share-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    payer: walletAddr,
                    baseMint: mint,
                    claimersArray,
                    basisPointsArray,
                }),
            });
            const feeData = await feeRes.json();
            if (!feeData.success) throw new Error(feeData.error || "Failed to create fee share config");

            const feeResult = feeData.data;
            const meteoraConfigKey = feeResult.meteoraConfigKey;

            // Sign and send fee share config transactions if needed
            if (feeResult.needsCreation) {
                const allTxs = [
                    ...(feeResult.transactions || []),
                    ...(feeResult.bundles?.flat() || []),
                ];

                for (const txObj of allTxs) {
                    setTxStatus("signing");
                    const txBytes = bs58.decode(txObj.transaction);
                    const tx = VersionedTransaction.deserialize(txBytes);
                    const signed = await signTransaction(tx);
                    await sendSignedTransaction(signed);
                }
            }

            // Step 3: Create launch transaction
            setTxStatus("creating-launch");
            const launchRes = await fetch("/api/launch/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ipfs: metadataIpfs,
                    tokenMint: mint,
                    wallet: walletAddr,
                    initialBuyLamports,
                    configKey: meteoraConfigKey,
                    name: metadata.name,
                    symbol: metadata.symbol,
                    description: metadata.description,
                    imageUrl: metadata.imageUrl,
                    website: metadata.website,
                    twitter: metadata.twitter,
                    telegram: metadata.telegram,
                }),
            });
            const launchData = await launchRes.json();
            if (!launchData.success) throw new Error(launchData.error || "Failed to create launch tx");

            const launchTxData = typeof launchData.data === "string" ? launchData.data : launchData.data?.transaction || launchData.data?.serializedTransaction;
            if (launchTxData) {
                setTxStatus("signing");
                const txBytes = bs58.decode(launchTxData);
                const tx = VersionedTransaction.deserialize(txBytes);
                const signed = await signTransaction(tx);
                await sendSignedTransaction(signed);
            }
            setTxStatus("success");
        } catch (e) { setErrorMsg(String(e)); setTxStatus("error"); }
    }, [connected, publicKey, signTransaction, metadata, imageFile, claimers, initialBuyLamports, sendSignedTransaction, setVisible]);

    return (
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="mx-auto w-12 h-12 border-2 border-[#00ff41]/40 flex items-center justify-center mb-4" style={{ boxShadow: '0 0 16px rgba(0,255,65,0.1)' }}>
                    <Rocket className="w-6 h-6 text-[#00ff41]" />
                </div>
                <h1 className="text-lg tracking-[0.2em] text-[#00ff41]" style={{ textShadow: '0 0 8px rgba(0,255,65,0.3)' }}>
                    ╔══ LAUNCH ON BAGS ══╗
                </h1>
                <p className="text-[10px] text-[#00ff41]/30 mt-2 tracking-wider">
                    CREATE AND LAUNCH YOUR TOKEN WITH BAGS PARTNER FEE SHARING
                </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-8">
                {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex items-center gap-2">
                        <div className={cn(
                            "w-8 h-8 flex items-center justify-center text-[10px] tracking-wider transition-all border-2",
                            step >= s
                                ? "border-[#00ff41]/60 bg-[#00ff41]/15 text-[#00ff41]"
                                : "border-[#00ff41]/15 bg-black text-[#00ff41]/25"
                        )} style={step >= s ? { textShadow: '0 0 6px rgba(0,255,65,0.3)' } : undefined}>
                            {step > s ? <Check className="w-4 h-4" /> : s}
                        </div>
                        {s < 4 && <div className={cn("w-8 h-0.5", step > s ? "bg-[#00ff41]/40" : "bg-[#00ff41]/10")} />}
                    </div>
                ))}
            </div>

            {/* Step 1 */}
            {step === 1 && (
                <form onSubmit={handleSubmit(onMetadataSubmit)} className="space-y-4 animate-fade-in">
                    <div className="panel-header">╔══ TOKEN METADATA ══╗</div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="NAME *" error={errors.name?.message}><input {...register("name")} placeholder="My Token" className={inputClass} /></FormField>
                        <FormField label="SYMBOL *" error={errors.symbol?.message}><input {...register("symbol")} placeholder="TKN" className={inputClass} /></FormField>
                    </div>
                    <FormField label="DESCRIPTION *" error={errors.description?.message}>
                        <textarea {...register("description")} rows={3} placeholder="What is this token about?" className={cn(inputClass, "resize-none")} />
                    </FormField>

                    {/* Image Upload */}
                    <div>
                        <label className="text-[9px] text-[#00ff41]/25 tracking-[0.2em] mb-1 block">TOKEN IMAGE</label>
                        {imagePreview ? (
                            <div className="relative border border-[#00ff41]/25 bg-black/60 p-3">
                                <div className="flex items-center gap-4">
                                    <div className="relative w-20 h-20 flex-shrink-0 border border-[#00ff41]/20 overflow-hidden">
                                        <Image src={imagePreview} alt="Preview" fill className="object-cover" unoptimized />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] text-[#00ff41]/60 tracking-wider truncate">{imageFile?.name}</p>
                                        <p className="text-[9px] text-[#00ff41]/25 tracking-wider mt-0.5">
                                            {imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : ""}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                            <Check className="w-3 h-3 text-[#00ff41]" />
                                            <span className="text-[9px] text-[#00ff41]/60 tracking-wider">WILL UPLOAD ON LAUNCH</span>
                                        </div>
                                        {imageError && (
                                            <p className="text-[9px] text-[#ff4400]/60 mt-1 tracking-wider">{imageError}</p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={removeImage}
                                        className="p-1.5 text-[#00ff41]/20 hover:text-[#ff4400] transition-colors flex-shrink-0"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                onDrop={handleDrop}
                                onDragOver={(e) => e.preventDefault()}
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-[#00ff41]/15 bg-black/40 p-6 text-center cursor-pointer
                                           hover:border-[#00ff41]/30 hover:bg-[#00ff41]/[0.02] transition-all group"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleImageSelect(file);
                                    }}
                                />
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-10 h-10 border border-[#00ff41]/15 flex items-center justify-center group-hover:border-[#00ff41]/30 transition-colors">
                                        <Upload className="w-5 h-5 text-[#00ff41]/25 group-hover:text-[#00ff41]/50 transition-colors" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-[#00ff41]/40 tracking-wider">
                                            DRAG & DROP OR CLICK TO UPLOAD
                                        </p>
                                        <p className="text-[8px] text-[#00ff41]/20 tracking-wider mt-0.5">
                                            PNG, JPG, GIF, WEBP — MAX 5MB
                                        </p>
                                    </div>
                                </div>
                                {imageError && (
                                    <p className="text-[9px] text-[#ff4400]/60 mt-2 tracking-wider">{imageError}</p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <FormField label="WEBSITE" error={errors.website?.message}><input {...register("website")} placeholder="https://..." className={inputClass} /></FormField>
                        <FormField label="TWITTER" error={errors.twitter?.message}><input {...register("twitter")} placeholder="@handle" className={inputClass} /></FormField>
                        <FormField label="TELEGRAM" error={errors.telegram?.message}><input {...register("telegram")} placeholder="@group" className={inputClass} /></FormField>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button type="submit" className="px-6 py-2.5 border-2 border-[#00ff41]/50 bg-[#00ff41]/10 text-[#00ff41] text-xs tracking-wider hover:bg-[#00ff41]/20 transition-all flex items-center gap-2">
                            NEXT <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </form>
            )}

            {/* Step 2 */}
            {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                    <div className="panel-header">╔══ FEE SHARING ══╗</div>
                    <div className="p-3 border border-[#00aaff]/20 bg-[#00aaff]/5 text-[10px] text-[#00aaff]/60 flex items-start gap-2 tracking-wider">
                        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                            <p>BASIS POINTS (BPS) MUST TOTAL EXACTLY 10,000</p>
                            <p className="text-[#00aaff]/30 mt-0.5">10,000 BPS = 100%. DIVIDE AMONG FEE CLAIMERS.</p>
                        </div>
                    </div>

                    {claimers.map((claimer, idx) => (
                        <div key={idx} className="flex items-end gap-3 p-3 border border-[#00ff41]/10 bg-black/60">
                            <div className="flex-1">
                                <label className="text-[9px] text-[#00ff41]/25 tracking-[0.15em] mb-1 block">WALLET {idx + 1}</label>
                                <input value={claimer.wallet} onChange={(e) => updateClaimer(idx, "wallet", e.target.value)} placeholder="Solana wallet address" className={inputClass} />
                            </div>
                            <div className="w-28">
                                <label className="text-[9px] text-[#00ff41]/25 tracking-[0.15em] mb-1 block">BPS</label>
                                <input type="number" min="0" max="10000" value={claimer.bps} onChange={(e) => updateClaimer(idx, "bps", e.target.value)} className={inputClass} />
                            </div>
                            {claimers.length > 1 && (
                                <button onClick={() => removeClaimer(idx)} className="p-2 text-[#00ff41]/20 hover:text-[#ff4400] transition-colors"><Trash2 className="w-4 h-4" /></button>
                            )}
                        </div>
                    ))}

                    <button onClick={addClaimer} className="w-full py-2 border border-dashed border-[#00ff41]/15 text-[10px] text-[#00ff41]/30 hover:text-[#00ff41]/60 hover:border-[#00ff41]/30 transition-colors flex items-center justify-center gap-1 tracking-wider">
                        <Plus className="w-3 h-3" /> ADD CLAIMER
                    </button>

                    <div className="flex items-center justify-between py-2">
                        <span className="text-[10px] text-[#00ff41]/30 tracking-wider">TOTAL BPS</span>
                        <span className={cn("text-xs tracking-wider", totalBps === 10000 ? "text-[#00ff41]" : "text-[#ff4400]")}>{totalBps.toLocaleString()} / 10,000</span>
                    </div>

                    <div>
                        <label className="text-[9px] text-[#00ff41]/25 tracking-[0.2em] mb-1 block">INITIAL BUY (SOL)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={initialBuyLamports / 1_000_000_000 || ""}
                            onChange={(e) => setInitialBuyLamports(Math.floor(parseFloat(e.target.value || "0") * 1_000_000_000))}
                            placeholder="0.01"
                            className={inputClass}
                        />
                        <p className="text-[8px] text-[#00ff41]/20 mt-1 tracking-wider">
                            OPTIONAL: AMOUNT OF SOL TO BUY ON LAUNCH
                        </p>
                    </div>

                    <div className="flex justify-between pt-2">
                        <button onClick={() => setStep(1)} className="px-4 py-2 border border-[#00ff41]/15 text-[10px] text-[#00ff41]/40 hover:text-[#00ff41] transition-colors flex items-center gap-1 tracking-wider">
                            <ArrowLeft className="w-4 h-4" /> BACK
                        </button>
                        <button onClick={() => setStep(3)} className="px-6 py-2.5 border-2 border-[#00ff41]/50 bg-[#00ff41]/10 text-[#00ff41] text-xs tracking-wider hover:bg-[#00ff41]/20 transition-all flex items-center gap-2">
                            REVIEW <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3 */}
            {step === 3 && metadata && (
                <div className="space-y-4 animate-fade-in">
                    <div className="panel-header">╔══ REVIEW LAUNCH ══╗</div>
                    <div className="crt-panel p-5 space-y-3">
                        <h3 className="text-[9px] text-[#00ff41]/30 tracking-[0.2em]">TOKEN METADATA</h3>
                        <ReviewRow label="NAME" value={metadata.name} />
                        <ReviewRow label="SYMBOL" value={metadata.symbol} />
                        <ReviewRow label="DESCRIPTION" value={metadata.description} />
                        {(imagePreview || metadata.imageUrl) ? (
                            <div className="flex items-start justify-between py-1.5 border-b border-[#00ff41]/5">
                                <span className="text-[9px] text-[#00ff41]/25 tracking-[0.15em] flex-shrink-0">IMAGE</span>
                                <div className="relative w-16 h-16 ml-4 border border-[#00ff41]/20 overflow-hidden flex-shrink-0">
                                    <Image src={imagePreview || metadata.imageUrl || ""} alt="Token" fill className="object-cover" unoptimized />
                                </div>
                            </div>
                        ) : (
                            <ReviewRow label="IMAGE" value="—" />
                        )}
                        <ReviewRow label="WEBSITE" value={metadata.website || "—"} />
                        <ReviewRow label="TWITTER" value={metadata.twitter || "—"} />
                        <ReviewRow label="TELEGRAM" value={metadata.telegram || "—"} />
                    </div>
                    <div className="crt-panel p-5 space-y-3">
                        <h3 className="text-[9px] text-[#00ff41]/30 tracking-[0.2em]">FEE SHARING</h3>
                        {claimers.map((c, i) => (
                            <ReviewRow key={i} label={`CLAIMER ${i + 1}`} value={`${shortenAddress(c.wallet)} — ${c.bps} BPS`} />
                        ))}
                        <ReviewRow label="TOTAL BPS" value={`${totalBps} / 10,000`} />
                        <ReviewRow label="INITIAL BUY" value={initialBuyLamports > 0 ? `${(initialBuyLamports / 1_000_000_000).toFixed(4)} SOL` : "NONE"} />
                    </div>
                    <div className="flex justify-between pt-2">
                        <button onClick={() => setStep(2)} className="px-4 py-2 border border-[#00ff41]/15 text-[10px] text-[#00ff41]/40 hover:text-[#00ff41] transition-colors flex items-center gap-1 tracking-wider">
                            <ArrowLeft className="w-4 h-4" /> BACK
                        </button>
                        <button onClick={() => setStep(4)} className="px-6 py-2.5 border-2 border-[#00ff41]/50 bg-[#00ff41]/10 text-[#00ff41] text-xs tracking-wider hover:bg-[#00ff41]/20 transition-all flex items-center gap-2">
                            LAUNCH <Rocket className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 4 */}
            {step === 4 && (
                <div className="space-y-6 animate-fade-in text-center">
                    {txStatus === "idle" && (
                        <>
                            <h2 className="text-sm text-[#00ff41]/70 tracking-[0.15em]">READY TO LAUNCH</h2>
                            {!connected ? (
                                <button onClick={() => setVisible(true)} className="px-8 py-3 border-2 border-[#00ff41]/50 bg-[#00ff41]/10 text-[#00ff41] text-xs tracking-wider hover:bg-[#00ff41]/20 transition-all flex items-center gap-2 mx-auto">
                                    <Wallet className="w-4 h-4" /> CONNECT WALLET & LAUNCH
                                </button>
                            ) : (
                                <button onClick={executeLaunch} className="px-8 py-3 border-2 border-[#00ff41]/50 bg-[#00ff41]/15 text-[#00ff41] text-xs tracking-wider hover:bg-[#00ff41]/25 transition-all flex items-center gap-2 mx-auto" style={{ textShadow: '0 0 6px rgba(0,255,65,0.3)' }}>
                                    <Rocket className="w-4 h-4" /> EXECUTE LAUNCH
                                </button>
                            )}
                        </>
                    )}

                    {["creating-info", "creating-fees", "creating-launch", "signing"].includes(txStatus) && (
                        <div className="py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-[#00ff41]/50 mx-auto mb-4" />
                            <p className="text-[10px] text-[#00ff41]/40 tracking-wider">
                                {txStatus === "creating-info" && "CREATING TOKEN INFO..."}
                                {txStatus === "creating-fees" && "CREATING FEE SHARE CONFIG..."}
                                {txStatus === "creating-launch" && "CREATING LAUNCH TRANSACTION..."}
                                {txStatus === "signing" && "AWAITING WALLET SIGNATURE..."}
                            </p>
                        </div>
                    )}

                    {txStatus === "success" && (
                        <div className="py-8 space-y-4">
                            <div className="mx-auto w-16 h-16 border-2 border-[#00ff41]/50 bg-[#00ff41]/10 flex items-center justify-center" style={{ boxShadow: '0 0 20px rgba(0,255,65,0.15)' }}>
                                <Check className="w-8 h-8 text-[#00ff41]" />
                            </div>
                            <h2 className="text-sm text-[#00ff41] tracking-[0.2em]" style={{ textShadow: '0 0 8px rgba(0,255,65,0.3)' }}>TOKEN LAUNCHED</h2>
                            {tokenMint && (
                                <div className="space-y-2">
                                    <p className="text-[9px] text-[#00ff41]/30 tracking-wider">TOKEN MINT</p>
                                    <p className="text-[10px] text-[#00ff41]/60 bg-black/60 border border-[#00ff41]/15 p-2 break-all tracking-wider">{tokenMint}</p>
                                    <Link href={`/token/${tokenMint}`} className="inline-flex items-center gap-2 px-6 py-2.5 border-2 border-[#00ff41]/50 bg-[#00ff41]/10 text-[#00ff41] text-xs tracking-wider hover:bg-[#00ff41]/20 transition-all mt-2">
                                        VIEW TOKEN <ExternalLink className="w-4 h-4" />
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}

                    {txStatus === "error" && (
                        <div className="py-8 space-y-4">
                            <AlertCircle className="w-12 h-12 text-[#ff4400]/40 mx-auto" />
                            <h2 className="text-sm text-[#ff4400]/70 tracking-[0.15em]">LAUNCH FAILED</h2>
                            {errorMsg && <p className="text-[10px] text-[#ff4400]/40 border border-[#ff4400]/20 bg-[#ff4400]/5 p-3 max-w-md mx-auto tracking-wider">{errorMsg}</p>}
                            <button onClick={() => { setTxStatus("idle"); setErrorMsg(null); }} className="px-6 py-2.5 border border-[#00ff41]/20 text-[10px] text-[#00ff41]/40 hover:text-[#00ff41] transition-colors tracking-wider">
                                TRY AGAIN
                            </button>
                        </div>
                    )}

                    {txStatus !== "success" && (
                        <button onClick={() => setStep(3)} className="text-[10px] text-[#00ff41]/20 hover:text-[#00ff41]/50 transition-colors tracking-wider">
                            ← BACK TO REVIEW
                        </button>
                    )}
                </div>
            )}

            <RecentBagscanLaunches />
        </div>
    );
}

const inputClass =
    "w-full px-3 py-2.5 bg-black/60 border border-[#00ff41]/15 text-xs text-[#00ff41] placeholder-[#00ff41]/15 tracking-wider focus:outline-none focus:border-[#00ff41]/40 focus:shadow-[0_0_10px_rgba(0,255,65,0.08)] transition-all";

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-[9px] text-[#00ff41]/25 tracking-[0.2em] mb-1 block">{label}</label>
            {children}
            {error && <p className="text-[9px] text-[#ff4400]/60 mt-1 tracking-wider">{error}</p>}
        </div>
    );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between py-1.5 border-b border-[#00ff41]/5 last:border-0">
            <span className="text-[9px] text-[#00ff41]/25 tracking-[0.15em] flex-shrink-0">{label}</span>
            <span className="text-[10px] text-[#00ff41]/50 text-right ml-4 break-all tracking-wider">{value}</span>
        </div>
    );
}
