"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
    BAGS_CONFIG_TYPES,
    type BagsConfigType,
    type BagsIncorporationCategory,
} from "@/lib/bags/types";
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
type TxStatus =
    | "idle"
    | "creating-info"
    | "creating-fees"
    | "creating-launch"
    | "creating-company"
    | "signing"
    | "success"
    | "error";
type Provider = "twitter" | "x" | "github" | "kick" | "instagram" | "tiktok";

interface Claimer {
    recipient: string;
    bps: number;
    resolvedWallet: string | null;
}

interface FounderInput {
    firstName: string;
    lastName: string;
    email: string;
    nationalityCountry: string;
    taxResidencyCountry: string;
    residentialAddress: string;
    shareBasisPoint: number;
}

interface LookupResult {
    provider: string;
    username: string;
    wallet: string | null;
}

interface IncorporationDraft {
    projectName: string;
    category?: BagsIncorporationCategory;
    twitterHandle?: string;
    incorporationShareBasisPoint: number;
    preferredCompanyNames: string[];
    founders: FounderInput[];
}

interface PreparedLaunchSettings {
    resolvedClaimers: Claimer[];
    resolvedAdminWallet: string | null;
    incorporationDraft: IncorporationDraft | null;
}

const inputClass =
    "w-full border border-[#2dff79]/30 bg-[#04110a]/90 px-3 py-2.5 text-[12px] tracking-[0.14em] text-[#dcffe6] placeholder-[#7fb895]/45 shadow-[inset_0_0_18px_rgba(0,255,65,0.03)] transition-all focus:border-[#5dff91]/70 focus:bg-[#07150d] focus:text-[#f2fff6] focus:outline-none focus:shadow-[0_0_14px_rgba(0,255,65,0.12)]";
const selectClass = `${inputClass} appearance-none`;
const settingsPanelClass =
    "space-y-3 border border-[#2dff79]/20 bg-[#031109]/85 p-4 shadow-[0_0_18px_rgba(0,255,65,0.05)]";
const nestedPanelClass =
    "border border-[#2dff79]/16 bg-[#04120b]/85 shadow-[0_0_14px_rgba(0,255,65,0.04)]";
const heroStatCardClass = "launch-stat-card min-h-[92px] rounded-none";
const primaryActionClass =
    "launch-action-primary inline-flex items-center justify-center gap-2 rounded-none px-6 py-2.5 text-[11px] tracking-[0.18em] transition-all";
const secondaryActionClass =
    "launch-action-secondary inline-flex items-center justify-center gap-2 rounded-none px-4 py-2.5 text-[10px] tracking-[0.18em] transition-all";
const reviewPanelClass =
    "space-y-3 border border-[#2dff79]/22 bg-[#03120a]/88 p-5 shadow-[0_0_24px_rgba(0,255,65,0.05),inset_0_0_22px_rgba(0,255,65,0.02)]";
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;
const PROVIDERS = new Set<Provider>(["twitter", "x", "github", "kick", "instagram", "tiktok"]);
const INCORPORATION_CATEGORIES: BagsIncorporationCategory[] = [
    "AI",
    "DEFI",
    "INFRA",
    "DEPIN",
    "LEGAL",
    "GAMING",
    "NFT",
    "MEME",
    "RWA",
];

const LAUNCH_TYPE_OPTIONS: Array<{
    id: BagsConfigType;
    label: string;
    description: string;
}> = [
    {
        id: BAGS_CONFIG_TYPES.DEFAULT,
        label: "Founder Mode",
        description: "Default Bags launch curve with founder-friendly fee flow.",
    },
    {
        id: BAGS_CONFIG_TYPES.BPS25PRE_BPS100POST_5000_COMPOUNDING,
        label: "Low Fee Mode",
        description: "A lighter fee profile after bonding for cleaner secondary trading.",
    },
    {
        id: BAGS_CONFIG_TYPES.BPS100PRE_BPS25POST_5000_COMPOUNDING,
        label: "Compounding Mode",
        description: "Keeps more fee power early, then cools off after migration.",
    },
    {
        id: BAGS_CONFIG_TYPES.BPS1000PRE_BPS1000POST_5000_COMPOUNDING,
        label: "Paper Hand Tax Mode",
        description: "A higher-friction option for strong fee capture and stickier holders.",
    },
];

const INCORPORATION_SHARE_OPTIONS = [
    { value: 2000, label: "20%" },
    { value: 2500, label: "25%" },
    { value: 3000, label: "30%" },
];

const STEP_META: Array<{ step: LaunchStep; label: string }> = [
    { step: 1, label: "Metadata" },
    { step: 2, label: "Settings" },
    { step: 3, label: "Review" },
    { step: 4, label: "Launch" },
];

export default function LaunchPage() {
    const { connected, publicKey, signTransaction } = useWallet();
    const { setVisible } = useWalletModal();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<LaunchStep>(1);
    const [metadata, setMetadata] = useState<MetadataForm | null>(null);
    const [claimers, setClaimers] = useState<Claimer[]>([{ recipient: "", bps: 0, resolvedWallet: null }]);
    const [enableFeeSharing, setEnableFeeSharing] = useState(false);
    const [launchType, setLaunchType] = useState<BagsConfigType>(BAGS_CONFIG_TYPES.DEFAULT);
    const [adminRecipient, setAdminRecipient] = useState("");
    const [adminResolvedWallet, setAdminResolvedWallet] = useState<string | null>(null);
    const [initialBuyLamports, setInitialBuyLamports] = useState(0);
    const [tipWallet, setTipWallet] = useState("");
    const [tipSol, setTipSol] = useState("");
    const [includePartner, setIncludePartner] = useState(true);
    const [launchCompany, setLaunchCompany] = useState(false);
    const [incorporationProjectName, setIncorporationProjectName] = useState("");
    const [companyCategory, setCompanyCategory] = useState<BagsIncorporationCategory>("AI");
    const [companyTwitterHandle, setCompanyTwitterHandle] = useState("");
    const [incorporationShareBps, setIncorporationShareBps] = useState(2000);
    const [preferredCompanyNames, setPreferredCompanyNames] = useState<string[]>(["", "", ""]);
    const [founders, setFounders] = useState<FounderInput[]>([createFounderInput(8000)]);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const [tokenMint, setTokenMint] = useState<string | null>(null);
    const [companyNotice, setCompanyNotice] = useState<string | null>(null);
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

    useEffect(
        () => () => {
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }
        },
        [imagePreview]
    );

    useEffect(() => {
        if (founders.length === 1) {
            setFounders((current) => [
                {
                    ...current[0],
                    shareBasisPoint: 10000 - incorporationShareBps,
                },
            ]);
        }
    }, [founders.length, incorporationShareBps]);

    const activeClaimers = useMemo(
        () => (enableFeeSharing ? claimers.filter((claimer) => claimer.recipient.trim()) : []),
        [claimers, enableFeeSharing]
    );
    const externalBps = activeClaimers.reduce((sum, claimer) => sum + claimer.bps, 0);
    const creatorBps = Math.max(0, 10000 - externalBps);
    const tipLamports = toLamports(tipSol);
    const founderTargetBps = 10000 - incorporationShareBps;
    const founderAssignedBps = founders.reduce((sum, founder) => sum + founder.shareBasisPoint, 0);

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

    const setFounderField = useCallback(
        (index: number, field: keyof FounderInput, value: string | number) => {
            setFounders((prev) =>
                prev.map((founder, currentIndex) =>
                    currentIndex === index
                        ? {
                            ...founder,
                            [field]:
                                field === "shareBasisPoint"
                                    ? Number(value) || 0
                                    : typeof value === "string"
                                        ? value
                                        : String(value),
                        }
                        : founder
                )
            );
        },
        []
    );

    const setPreferredCompanyName = useCallback((index: number, value: string) => {
        setPreferredCompanyNames((prev) =>
            prev.map((entry, currentIndex) => (currentIndex === index ? value : entry))
        );
    }, []);

    const handleImageSelect = useCallback(
        (file: File) => {
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
        },
        [imagePreview]
    );

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

    const onMetadataSubmit = useCallback(
        (data: MetadataForm) => {
            setImageError(null);
            setErrorMsg(null);
            if (!imageFile && !data.imageUrl && !data.metadataUrl) {
                setImageError("ADD AN IMAGE FILE, IMAGE URL, OR METADATA URL BEFORE CONTINUING");
                return;
            }

            const normalizedMetadata: MetadataForm = {
                ...data,
                twitter: normalizeTwitterInput(data.twitter),
                telegram: normalizeTelegramInput(data.telegram),
            };

            if (!incorporationProjectName.trim()) {
                setIncorporationProjectName(normalizedMetadata.name);
            }
            if (preferredCompanyNames.every((name) => !name.trim())) {
                setPreferredCompanyNames(createPreferredCompanyNames(normalizedMetadata.name));
            }
            if (!companyTwitterHandle.trim()) {
                setCompanyTwitterHandle(extractTwitterHandle(normalizedMetadata.twitter) ?? "");
            }

            setMetadata(normalizedMetadata);
            setStep(2);
        },
        [companyTwitterHandle, imageFile, incorporationProjectName, preferredCompanyNames]
    );

    const resolveSingleRecipient = useCallback(async (rawRecipient: string, label: string) => {
        const parsed = parseRecipient(rawRecipient);
        if (parsed.kind === "empty") return null;
        if (parsed.kind === "invalid") throw new Error(parsed.message.replace("RECIPIENT", label));
        if (parsed.kind === "wallet") return parsed.wallet;

        const response = await fetch("/api/launch/resolve-fee-wallets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: [{ provider: parsed.provider, username: parsed.username }],
            }),
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || `FAILED TO RESOLVE ${label}`);
        }

        const wallet = (data.data as LookupResult[])[0]?.wallet;
        if (!wallet) {
            throw new Error(`NO BAGS WALLET FOUND FOR ${label.toUpperCase()} ${parsed.provider}:${parsed.username}`);
        }

        return wallet;
    }, []);

    const resolveClaimers = useCallback(async () => {
        const active = enableFeeSharing ? claimers.filter((claimer) => claimer.recipient.trim()) : [];
        if (active.some((claimer) => claimer.bps <= 0)) {
            throw new Error("EVERY EXTRA RECIPIENT NEEDS BPS GREATER THAN 0");
        }
        if (active.reduce((sum, claimer) => sum + claimer.bps, 0) > 10000) {
            throw new Error("EXTRA RECIPIENTS CANNOT EXCEED 10,000 BPS");
        }

        const walletByIndex = new Map<number, string>();
        const lookups: Array<{ index: number; provider: Provider; username: string }> = [];

        active.forEach((claimer, index) => {
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
            resolvedWallet:
                enableFeeSharing && claimer.recipient.trim() ? walletByIndex.get(index) ?? null : null,
        }));
        setClaimers(resolved);
        return resolved;
    }, [claimers, enableFeeSharing]);

    const prepareLaunchSettings = useCallback(async (): Promise<PreparedLaunchSettings> => {
        const resolvedClaimers = enableFeeSharing
            ? await resolveClaimers()
            : claimers.map((claimer) => ({ ...claimer, resolvedWallet: null }));

        const resolvedAdminWallet = await resolveSingleRecipient(adminRecipient, "ADMIN");
        setAdminResolvedWallet(resolvedAdminWallet);

        if (!launchCompany) {
            return {
                resolvedClaimers,
                resolvedAdminWallet,
                incorporationDraft: null,
            };
        }

        const projectName = incorporationProjectName.trim() || metadata?.name?.trim() || "";
        if (!projectName) {
            throw new Error("PROJECT NAME IS REQUIRED FOR COMPANY INCORPORATION");
        }

        const preparedPreferredCompanyNames = preferredCompanyNames.map((value) => value.trim());
        if (preparedPreferredCompanyNames.some((value) => !value)) {
            throw new Error("ADD ALL THREE PREFERRED COMPANY NAMES");
        }
        if (new Set(preparedPreferredCompanyNames.map((value) => value.toLowerCase())).size !== 3) {
            throw new Error("PREFERRED COMPANY NAMES MUST BE UNIQUE");
        }

        const preparedFounders = founders.map((founder) => ({
            firstName: founder.firstName.trim(),
            lastName: founder.lastName.trim(),
            email: founder.email.trim(),
            nationalityCountry: founder.nationalityCountry.trim().toUpperCase(),
            taxResidencyCountry: founder.taxResidencyCountry.trim().toUpperCase(),
            residentialAddress: founder.residentialAddress.trim(),
            shareBasisPoint: founder.shareBasisPoint,
        }));

        if (preparedFounders.some((founder) => !founder.firstName || !founder.lastName || !founder.email || !founder.residentialAddress)) {
            throw new Error("COMPLETE ALL FOUNDER FIELDS BEFORE CONTINUING");
        }
        if (
            preparedFounders.some(
                (founder) =>
                    founder.nationalityCountry.length !== 3 ||
                    founder.taxResidencyCountry.length !== 3
            )
        ) {
            throw new Error("USE ISO ALPHA-3 COUNTRY CODES LIKE USA, TUR, OR GBR");
        }

        const founderShareTotal = preparedFounders.reduce(
            (sum, founder) => sum + founder.shareBasisPoint,
            0
        );
        if (founderShareTotal !== 10000 - incorporationShareBps) {
            throw new Error(
                `FOUNDER SHARES MUST TOTAL ${10000 - incorporationShareBps} BPS WHEN COMPANY SHARE IS ${incorporationShareBps} BPS`
            );
        }

        return {
            resolvedClaimers,
            resolvedAdminWallet,
            incorporationDraft: {
                projectName,
                category: companyCategory,
                twitterHandle: companyTwitterHandle.trim() || extractTwitterHandle(metadata?.twitter) || undefined,
                incorporationShareBasisPoint: incorporationShareBps,
                preferredCompanyNames: preparedPreferredCompanyNames,
                founders: preparedFounders,
            },
        };
    }, [
        adminRecipient,
        claimers,
        companyCategory,
        companyTwitterHandle,
        enableFeeSharing,
        founders,
        incorporationProjectName,
        incorporationShareBps,
        launchCompany,
        metadata,
        preferredCompanyNames,
        resolveClaimers,
        resolveSingleRecipient,
    ]);

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
        setCompanyNotice(null);

        try {
            const preparedSettings = await prepareLaunchSettings();
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
            const active = enableFeeSharing
                ? preparedSettings.resolvedClaimers.filter((claimer) => claimer.recipient.trim())
                : [];
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
                    admin: preparedSettings.resolvedAdminWallet || undefined,
                    bagsConfigType: launchType,
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
                for (const txObject of [
                    ...(feeData.data.transactions || []),
                    ...(feeData.data.bundles?.flat() || []),
                ]) {
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

            if (launchCompany && preparedSettings.incorporationDraft) {
                try {
                    setTxStatus("creating-company");

                    const startResponse = await fetch("/api/incorporation/start", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            tokenAddress: infoData.data.tokenMint,
                        }),
                    });
                    const startData = await startResponse.json();
                    if (!startData.success) {
                        throw new Error(startData.error || "FAILED TO START INCORPORATION");
                    }

                    const paymentResponse = await fetch("/api/incorporation/start-payment", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            payerWallet: wallet,
                            payWithSol: true,
                        }),
                    });
                    const paymentData = await paymentResponse.json();
                    if (!paymentData.success) {
                        throw new Error(paymentData.error || "FAILED TO CREATE INCORPORATION PAYMENT");
                    }

                    setTxStatus("signing");
                    const signedPayment = await signTransaction(
                        VersionedTransaction.deserialize(
                            decodeTransactionData(paymentData.data.transaction)
                        )
                    );
                    const paymentSignature = await sendSignedTransaction(signedPayment);

                    const incorporateResponse = await fetch("/api/incorporation/incorporate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            orderUUID: paymentData.data.orderUUID,
                            paymentSignature,
                            projectName: preparedSettings.incorporationDraft.projectName,
                            tokenAddress: infoData.data.tokenMint,
                            founders: preparedSettings.incorporationDraft.founders,
                            category: preparedSettings.incorporationDraft.category,
                            twitterHandle: preparedSettings.incorporationDraft.twitterHandle,
                            incorporationShareBasisPoint:
                                preparedSettings.incorporationDraft.incorporationShareBasisPoint,
                            preferredCompanyNames:
                                preparedSettings.incorporationDraft.preferredCompanyNames,
                        }),
                    });
                    const incorporateData = await incorporateResponse.json();
                    if (!incorporateData.success) {
                        throw new Error(incorporateData.error || "FAILED TO FINISH INCORPORATION");
                    }

                    setCompanyNotice(
                        `COMPANY INCORPORATION SUBMITTED FOR ${preparedSettings.incorporationDraft.projectName}.`
                    );
                } catch (companyError) {
                    setCompanyNotice(
                        `TOKEN LAUNCHED, BUT COMPANY INCORPORATION STILL NEEDS ATTENTION: ${formatError(companyError)}`
                    );
                }
            }

            setTxStatus("success");
        } catch (error) {
            setErrorMsg(formatError(error));
            setTxStatus("error");
        }
    }, [
        connected,
        enableFeeSharing,
        imageFile,
        includePartner,
        initialBuyLamports,
        launchCompany,
        launchType,
        metadata,
        prepareLaunchSettings,
        publicKey,
        sendSignedTransaction,
        setVisible,
        signTransaction,
        tipLamports,
        tipWallet,
    ]);

    return (
        <div className="launch-shell mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="launch-hero mb-8 p-5 sm:p-7">
                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                        <div className="mb-4 flex flex-wrap gap-2">
                            <span className="launch-chip">
                                <Rocket className="h-3.5 w-3.5 text-[#69ff9d]" />
                                OFFICIAL BAGS LAUNCH
                            </span>
                            <span className="launch-chip launch-chip-blue">SDK 1.3.5 READY</span>
                            <span className="launch-chip launch-chip-amber">COMPANY OPTIONAL</span>
                        </div>
                        <div className="mb-5 flex h-14 w-14 items-center justify-center border border-[#52ff8c]/40 bg-[#03140b]/88 shadow-[0_0_24px_rgba(0,255,65,0.12)]">
                            <Rocket className="h-7 w-7 text-[#69ff9d]" />
                        </div>
                        <h1 className="launch-hero-title text-xl sm:text-2xl">LAUNCH ON BAGS</h1>
                        <p className="launch-hero-copy mt-3 max-w-2xl text-[10px] sm:text-[11px]">
                            Create the token, tune the official Bags fee surface, and handle company
                            incorporation only when you actually want it. The flow below is built to
                            stay readable under pressure and premium when it matters.
                        </p>
                    </div>

                    <div className="launch-stat-grid w-full lg:max-w-sm">
                        <div className={heroStatCardClass}>
                            <div className="launch-stat-label">Launch Surface</div>
                            <div className="launch-stat-value">Project setup, fees, admin, company</div>
                            <div className="launch-stat-note">
                                One guided flow from metadata to final signature
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                            <div className={heroStatCardClass}>
                                <div className="launch-stat-label">Reliability</div>
                                <div className="launch-stat-value">Confirmed transaction checks</div>
                                <div className="launch-stat-note">
                                    Retries, confirmation waits, and safer submission guards
                                </div>
                            </div>
                            <div className={heroStatCardClass}>
                                <div className="launch-stat-label">Metadata Path</div>
                                <div className="launch-stat-value">Hosted metadata handoff</div>
                                <div className="launch-stat-note">
                                    Cleaner uploads and a steadier official Bags API path
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-8">
                <div className="mx-auto grid max-w-3xl grid-cols-4 gap-3 sm:gap-4">
                    {STEP_META.map((meta, index) => (
                        <div key={meta.step} className="relative flex flex-col items-center gap-2">
                            {index < STEP_META.length - 1 ? (
                                <div
                                    className={cn(
                                        "absolute left-[calc(50%+1.3rem)] top-4 hidden h-px w-[calc(100%-1.8rem)] sm:block",
                                        step > meta.step ? "bg-[#5dff91]/55" : "bg-[#2dff79]/18"
                                    )}
                                />
                            ) : null}
                            <div
                                className={cn(
                                    "relative z-10 flex h-9 w-9 items-center justify-center border text-[10px] tracking-[0.18em] transition-all sm:h-10 sm:w-10",
                                    step > meta.step &&
                                        "border-[#69ff9d]/55 bg-[linear-gradient(180deg,rgba(0,255,65,0.18),rgba(0,255,65,0.08))] text-[#effff4] shadow-[0_0_18px_rgba(0,255,65,0.12)]",
                                    step === meta.step &&
                                        "border-[#8dd8ff]/55 bg-[linear-gradient(180deg,rgba(0,170,255,0.18),rgba(0,170,255,0.07))] text-[#eff8ff] shadow-[0_0_22px_rgba(0,170,255,0.16)]",
                                    step < meta.step &&
                                        "border-[#2dff79]/20 bg-[#031109] text-[#8fe8a8]/55"
                                )}
                            >
                                {step > meta.step ? <Check className="h-4 w-4" /> : meta.step}
                            </div>
                            <span
                                className={cn(
                                    "launch-step-label text-center",
                                    step >= meta.step && "launch-step-active"
                                )}
                            >
                                {meta.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {step === 1 ? (
                <form onSubmit={handleSubmit(onMetadataSubmit)} className="space-y-5">
                    <div className="space-y-4 border border-[#2dff79]/20 bg-[#021109]/86 p-5 shadow-[0_0_24px_rgba(0,255,65,0.05)]">
                    <div className="panel-header">PROJECT INFO</div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="NAME *" error={errors.name?.message}>
                            <input {...register("name")} placeholder="My Project" className={inputClass} />
                        </Field>
                        <Field label="TICKER *" error={errors.symbol?.message}>
                            <input {...register("symbol")} placeholder="TKN" className={inputClass} />
                        </Field>
                    </div>
                    <Field label="DESCRIPTION *" error={errors.description?.message}>
                        <textarea
                            {...register("description")}
                            rows={3}
                            placeholder="What is this token about?"
                            className={cn(inputClass, "resize-none")}
                        />
                    </Field>

                    <div>
                        <label className="mb-1 block text-[9px] tracking-[0.2em] text-[#8fe8a8]/72">
                            TOKEN IMAGE
                        </label>
                        {imagePreview ? (
                            <div className="flex flex-col gap-4 border border-[#2dff79]/24 bg-[#04120b]/84 p-4 shadow-[0_0_18px_rgba(0,255,65,0.04)] sm:flex-row sm:items-center">
                                <div className="relative h-20 w-20 overflow-hidden border border-[#3eff82]/25">
                                    <Image src={imagePreview} alt="Preview" fill className="object-cover" unoptimized />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[10px] tracking-wider text-[#dfffe8]">
                                        {imageFile?.name}
                                    </p>
                                    <p className="mt-1 text-[9px] tracking-wider text-[#8fe8a8]/60">
                                        {imageFile ? `${(imageFile.size / 1024 / 1024).toFixed(2)} MB` : ""}
                                    </p>
                                    <p className="mt-1 text-[9px] tracking-wider text-[#8fe8a8]/72">
                                        READY FOR BAGS METADATA CREATION
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={removeImage}
                                    className="p-1.5 text-[#8fe8a8]/45 transition-colors hover:text-[#ff8f67]"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <div
                                onDrop={(event) => {
                                    event.preventDefault();
                                    const file = event.dataTransfer.files[0];
                                    if (file) handleImageSelect(file);
                                }}
                                onDragOver={(event) => event.preventDefault()}
                                onClick={() => fileInputRef.current?.click()}
                                className="cursor-pointer border-2 border-dashed border-[#2dff79]/24 bg-[#04110a]/76 p-7 text-center shadow-[inset_0_0_32px_rgba(0,255,65,0.02)] transition-all hover:border-[#5dff91]/42 hover:bg-[#00ff41]/[0.04]"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,image/webp"
                                    className="hidden"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) handleImageSelect(file);
                                    }}
                                />
                                <Upload className="mx-auto h-5 w-5 text-[#8fe8a8]/70" />
                                <p className="mt-2 text-[10px] tracking-wider text-[#dbffe6]">
                                    DRAG, DROP, OR CLICK TO UPLOAD
                                </p>
                                <p className="mt-1 text-[8px] tracking-wider text-[#8fe8a8]/55">
                                    PNG / JPG / WEBP - MAX 15MB
                                </p>
                            </div>
                        )}
                        {imageError ? (
                            <p className="mt-2 text-[9px] tracking-wider text-[#ff9f7f]">{imageError}</p>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="IMAGE URL" error={errors.imageUrl?.message}>
                            <input
                                {...register("imageUrl")}
                                placeholder="https://example.com/token.png"
                                className={inputClass}
                            />
                        </Field>
                        <Field label="METADATA URL" error={errors.metadataUrl?.message}>
                            <input
                                {...register("metadataUrl")}
                                placeholder="https://example.com/metadata.json"
                                className={inputClass}
                            />
                        </Field>
                    </div>

                    <div className="rounded-none border border-[#5bc2ff]/28 bg-[#00aaff]/9 p-3 text-[10px] tracking-wider text-[#b8ecff] shadow-[0_0_18px_rgba(0,170,255,0.06)]">
                        <div className="flex items-start gap-2">
                            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <div>
                                <p>USE AN IMAGE FILE, IMAGE URL, OR READY METADATA URL.</p>
                                <p className="mt-1 text-[#b8ecff]/78">
                                    BAGSCAN NORMALIZES SOCIAL LINKS TO THE FORMAT THE OFFICIAL SDK EXPECTS.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Field label="WEBSITE" error={errors.website?.message}>
                            <input {...register("website")} placeholder="https://..." className={inputClass} />
                        </Field>
                        <Field label="TWITTER / X" error={errors.twitter?.message}>
                            <input {...register("twitter")} placeholder="@handle or URL" className={inputClass} />
                        </Field>
                        <Field label="TELEGRAM" error={errors.telegram?.message}>
                            <input {...register("telegram")} placeholder="@group or URL" className={inputClass} />
                        </Field>
                    </div>

                    </div>

                    <div className="flex justify-end">
                        <button type="submit" className={primaryActionClass}>
                            NEXT <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </form>
            ) : null}

            {step === 2 ? (
                <div className="space-y-4">
                    <div className="panel-header">LAUNCH SETTINGS</div>

                    <div className={settingsPanelClass}>
                        <div>
                            <p className="text-[10px] tracking-wider text-[#00ff41]/50">LAUNCH TYPE</p>
                            <p className="mt-1 text-[8px] tracking-wider text-[#00ff41]/20">
                                PICK THE OFFICIAL BAGS CONFIG THAT DEFINES HOW YOUR MARKET BEHAVES.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {LAUNCH_TYPE_OPTIONS.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => setLaunchType(option.id)}
                                    className={cn(
                                        "border p-3 text-left transition-all",
                                        launchType === option.id
                                            ? "border-[#00ff41]/45 bg-[#00ff41]/10"
                                            : "border-[#00ff41]/10 bg-black/50 hover:border-[#00ff41]/25"
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[10px] tracking-[0.16em] text-[#00ff41]">
                                            {option.label}
                                        </span>
                                        {launchType === option.id ? (
                                            <Check className="h-4 w-4 text-[#00ff41]" />
                                        ) : null}
                                    </div>
                                    <p className="mt-2 text-[8px] tracking-[0.14em] text-[#00ff41]/30">
                                        {option.description}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={settingsPanelClass}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-[10px] tracking-wider text-[#00ff41]/50">FEE SHARING</p>
                                <p className="mt-1 text-[8px] tracking-wider text-[#00ff41]/20">
                                    SHARE FEES WITH WALLETS OR SOCIAL IDENTITIES. THE CREATOR SPLIT IS ALWAYS INCLUDED.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEnableFeeSharing((current) => !current)}
                                className={cn(
                                    "min-w-20 border px-3 py-2 text-[10px] tracking-wider transition-colors",
                                    enableFeeSharing
                                        ? "border-[#00ff41]/40 bg-[#00ff41]/10 text-[#00ff41]"
                                        : "border-[#00ff41]/15 bg-black text-[#00ff41]/30"
                                )}
                            >
                                {enableFeeSharing ? "ENABLED" : "DISABLED"}
                            </button>
                        </div>
                        {enableFeeSharing ? (
                            <>
                                {claimers.map((claimer, index) => (
                                    <div
                                        key={index}
                                        className={cn("flex flex-col gap-3 p-3 sm:flex-row sm:items-end", nestedPanelClass)}
                                    >
                                        <div className="flex-1">
                                            <label className="mb-1 block text-[9px] tracking-[0.15em] text-[#00ff41]/25">
                                                RECIPIENT {index + 1}
                                            </label>
                                            <input
                                                value={claimer.recipient}
                                                onChange={(event) =>
                                                    setClaimerField(index, "recipient", event.target.value)
                                                }
                                                placeholder="Wallet or provider:username"
                                                className={inputClass}
                                            />
                                            {claimer.resolvedWallet ? (
                                                <p className="mt-1 text-[8px] tracking-wider text-[#00ff41]/25">
                                                    RESOLVED: {shortenAddress(claimer.resolvedWallet)}
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="w-full sm:w-28">
                                            <label className="mb-1 block text-[9px] tracking-[0.15em] text-[#00ff41]/25">
                                                BPS
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="10000"
                                                value={claimer.bps}
                                                onChange={(event) =>
                                                    setClaimerField(index, "bps", event.target.value)
                                                }
                                                className={inputClass}
                                            />
                                        </div>
                                        {claimers.length > 1 ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setClaimers((prev) =>
                                                        prev.filter((_, currentIndex) => currentIndex !== index)
                                                    )
                                                }
                                                className="p-2 text-[#00ff41]/20 transition-colors hover:text-[#ff4400]"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        ) : null}
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={() =>
                                        setClaimers((prev) => [
                                            ...prev,
                                            { recipient: "", bps: 0, resolvedWallet: null },
                                        ])
                                    }
                                    className="flex w-full items-center justify-center gap-1 border border-dashed border-[#00ff41]/15 py-2 text-[10px] tracking-wider text-[#00ff41]/30 transition-colors hover:border-[#00ff41]/30 hover:text-[#00ff41]/60"
                                >
                                    <Plus className="h-3 w-3" /> ADD RECIPIENT
                                </button>
                            </>
                        ) : (
                            <div className="rounded-none border border-[#2dff79]/18 bg-[#04120b]/75 p-3 text-[10px] tracking-wider text-[#b6ffca]/70">
                                FEE SHARING IS OFF. THE CREATOR WILL KEEP THE FULL 10,000 BPS CONFIG.
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <StatBox
                                label="EXTERNAL RECIPIENTS"
                                value={`${externalBps} / 10,000`}
                                note="EXTRA CLAIMERS ARE RESOLVED THROUGH BAGS BEFORE THE CONFIG TX IS CREATED."
                                invalid={externalBps > 10000}
                            />
                            <StatBox
                                label="CREATOR SHARE"
                                value={`${creatorBps} BPS`}
                                note="THE PRIMARY LAUNCH WALLET ALWAYS STAYS IN THE CONFIG."
                            />
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-[10px] tracking-wider text-[#00ff41]/50">BAGSCAN PARTNER FEE</p>
                                <p className="mt-1 text-[8px] tracking-wider text-[#00ff41]/20">
                                    KEEP THIS ON TO INCLUDE THE BAGSCAN PARTNER CONFIG IN THE OFFICIAL BAGS FLOW.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIncludePartner((current) => !current)}
                                className={cn(
                                    "min-w-20 border px-3 py-2 text-[10px] tracking-wider transition-colors",
                                    includePartner
                                        ? "border-[#00ff41]/40 bg-[#00ff41]/10 text-[#00ff41]"
                                        : "border-[#00ff41]/15 bg-black text-[#00ff41]/30"
                                )}
                            >
                                {includePartner ? "ENABLED" : "DISABLED"}
                            </button>
                        </div>
                    </div>

                    <div className={settingsPanelClass}>
                        <div>
                            <p className="text-[10px] tracking-wider text-[#00ff41]/50">ADMIN SETTINGS</p>
                            <p className="mt-1 text-[8px] tracking-wider text-[#00ff41]/20">
                                OPTIONAL. SET A WALLET OR `provider:username` TO MANAGE FEE SETTINGS LATER.
                            </p>
                        </div>
                        <Field label="ADMIN">
                            <input
                                value={adminRecipient}
                                onChange={(event) => {
                                    setAdminRecipient(event.target.value);
                                    setAdminResolvedWallet(null);
                                }}
                                placeholder="Wallet or provider:username"
                                className={inputClass}
                            />
                        </Field>
                        {adminResolvedWallet ? (
                            <div className="rounded-none border border-[#8dd8ff]/20 bg-[#8dd8ff]/5 p-3 text-[10px] tracking-wider text-[#8dd8ff]/60">
                                ADMIN WILL RESOLVE TO {shortenAddress(adminResolvedWallet)}
                            </div>
                        ) : null}
                    </div>

                    <div className={settingsPanelClass}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-[10px] tracking-wider text-[#00ff41]/50">LAUNCH A COMPANY</p>
                                <p className="mt-1 text-[8px] tracking-wider text-[#00ff41]/20">
                                    IF YOU WANT BAGSCAN TO HANDLE INCORPORATION, FILL THE LEGAL DETAILS HERE.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLaunchCompany((current) => !current)}
                                className={cn(
                                    "min-w-20 border px-3 py-2 text-[10px] tracking-wider transition-colors",
                                    launchCompany
                                        ? "border-[#00ff41]/40 bg-[#00ff41]/10 text-[#00ff41]"
                                        : "border-[#00ff41]/15 bg-black text-[#00ff41]/30"
                                )}
                            >
                                {launchCompany ? "ENABLED" : "DISABLED"}
                            </button>
                        </div>
                        {launchCompany ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field label="PROJECT NAME">
                                        <input
                                            value={incorporationProjectName}
                                            onChange={(event) => setIncorporationProjectName(event.target.value)}
                                            placeholder="Project legal name"
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="PROJECT X HANDLE">
                                        <input
                                            value={companyTwitterHandle}
                                            onChange={(event) =>
                                                setCompanyTwitterHandle(event.target.value.replace(/^@/, "").trim())
                                            }
                                            placeholder="bagsdotfm"
                                            className={inputClass}
                                        />
                                    </Field>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field label="COMPANY CATEGORY">
                                        <select
                                            value={companyCategory}
                                            onChange={(event) =>
                                                setCompanyCategory(event.target.value as BagsIncorporationCategory)
                                            }
                                            className={selectClass}
                                        >
                                            {INCORPORATION_CATEGORIES.map((category) => (
                                                <option key={category} value={category}>
                                                    {category}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="INCORPORATION SHARE">
                                        <select
                                            value={incorporationShareBps}
                                            onChange={(event) =>
                                                setIncorporationShareBps(Number(event.target.value))
                                            }
                                            className={selectClass}
                                        >
                                            {INCORPORATION_SHARE_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                </div>

                                <div className={cn("space-y-3 p-3", nestedPanelClass)}>
                                    <p className="text-[10px] tracking-wider text-[#00ff41]/40">PREFERRED COMPANY NAMES</p>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        {preferredCompanyNames.map((value, index) => (
                                            <input
                                                key={index}
                                                value={value}
                                                onChange={(event) => setPreferredCompanyName(index, event.target.value)}
                                                placeholder={`Choice ${index + 1}`}
                                                className={inputClass}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className={cn("space-y-3 p-3", nestedPanelClass)}>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-[10px] tracking-wider text-[#00ff41]/40">FOUNDERS</p>
                                            <p className="mt-1 text-[8px] tracking-wider text-[#00ff41]/20">
                                                FOUNDER SHARES MUST TOTAL {founderTargetBps} BPS. COMPANY SHARE IS {incorporationShareBps} BPS.
                                            </p>
                                        </div>
                                        {founders.length < 10 ? (
                                            <button
                                                type="button"
                                                onClick={() => setFounders((prev) => [...prev, createFounderInput(0)])}
                                                className="inline-flex items-center gap-1 border border-dashed border-[#00ff41]/20 px-3 py-2 text-[10px] tracking-wider text-[#00ff41]/35 transition-colors hover:border-[#00ff41]/35 hover:text-[#00ff41]/55"
                                            >
                                                <Plus className="h-3 w-3" /> ADD FOUNDER
                                            </button>
                                        ) : null}
                                    </div>

                                    {founders.map((founder, index) => (
                                        <div key={index} className={cn("space-y-3 p-3", nestedPanelClass)}>
                                            <div className="flex items-center justify-between">
                                                <p className="text-[10px] tracking-wider text-[#00ff41]/35">FOUNDER {index + 1}</p>
                                                {founders.length > 1 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setFounders((prev) =>
                                                                prev.filter((_, currentIndex) => currentIndex !== index)
                                                            )
                                                        }
                                                        className="p-1.5 text-[#00ff41]/20 transition-colors hover:text-[#ff4400]"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                ) : null}
                                            </div>

                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                <input value={founder.firstName} onChange={(event) => setFounderField(index, "firstName", event.target.value)} placeholder="First name" className={inputClass} />
                                                <input value={founder.lastName} onChange={(event) => setFounderField(index, "lastName", event.target.value)} placeholder="Last name" className={inputClass} />
                                                <input value={founder.email} onChange={(event) => setFounderField(index, "email", event.target.value)} placeholder="Email" className={inputClass} />
                                                <input type="number" min="0" max="10000" value={founder.shareBasisPoint} onChange={(event) => setFounderField(index, "shareBasisPoint", event.target.value)} placeholder="Share BPS" className={inputClass} />
                                                <input value={founder.nationalityCountry} onChange={(event) => setFounderField(index, "nationalityCountry", event.target.value.toUpperCase())} placeholder="Nationality (USA)" className={inputClass} />
                                                <input value={founder.taxResidencyCountry} onChange={(event) => setFounderField(index, "taxResidencyCountry", event.target.value.toUpperCase())} placeholder="Tax residency (USA)" className={inputClass} />
                                            </div>

                                            <textarea value={founder.residentialAddress} onChange={(event) => setFounderField(index, "residentialAddress", event.target.value)} rows={2} placeholder="Residential address" className={cn(inputClass, "resize-none")} />
                                        </div>
                                    ))}

                                    <StatBox
                                        label="FOUNDER SHARE TOTAL"
                                        value={`${founderAssignedBps} / ${founderTargetBps}`}
                                        note="THIS MUST MATCH THE REMAINING BPS AFTER THE COMPANY SHARE."
                                        invalid={founderAssignedBps !== founderTargetBps}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-none border border-[#2dff79]/18 bg-[#04120b]/75 p-3 text-[10px] tracking-wider text-[#b6ffca]/70">
                                KEEP THIS OFF IF YOU JUST WANT A CLEAN TOKEN LAUNCH. TURN IT ON ONLY WHEN YOU ARE READY TO PAY FOR INCORPORATION AND SUBMIT FOUNDER DATA.
                            </div>
                        )}
                    </div>

                    <div className={settingsPanelClass}>
                        <div>
                            <p className="text-[10px] tracking-wider text-[#00ff41]/50">OWNERSHIP AND TIPS</p>
                            <p className="mt-1 text-[8px] tracking-wider text-[#00ff41]/20">
                                SET YOUR INITIAL BUY, PLUS OPTIONAL TIP CONFIG FOR THE OFFICIAL BAGS TXS.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="INITIAL BUY (SOL)">
                                <input type="number" min="0" step="0.001" value={initialBuyLamports > 0 ? initialBuyLamports / 1_000_000_000 : ""} onChange={(event) => setInitialBuyLamports(Math.max(0, Math.floor(Number(event.target.value || "0") * 1_000_000_000)))} placeholder="0.01" className={inputClass} />
                            </Field>
                            <Field label="TIP AMOUNT (SOL)">
                                <input type="number" min="0" step="0.000001" value={tipSol} onChange={(event) => setTipSol(event.target.value)} placeholder="0.001" className={inputClass} />
                            </Field>
                        </div>
                        <Field label="TIP WALLET">
                            <input value={tipWallet} onChange={(event) => setTipWallet(event.target.value)} placeholder="Optional Solana wallet for tipLamports" className={inputClass} />
                        </Field>
                    </div>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                        <button type="button" onClick={() => { setErrorMsg(null); setTxStatus("idle"); setStep(1); }} className={secondaryActionClass}>
                            <ArrowLeft className="h-4 w-4" /> BACK
                        </button>
                        <button type="button" onClick={async () => { try { setErrorMsg(null); await prepareLaunchSettings(); setStep(3); } catch (error) { setErrorMsg(formatError(error)); setTxStatus("error"); } }} className={primaryActionClass}>
                            REVIEW <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ) : null}
            {step === 3 && metadata ? (
                <div className="space-y-4">
                    <div className="panel-header">REVIEW LAUNCH</div>
                    <div className={reviewPanelClass}>
                        <h3 className="text-[9px] tracking-[0.2em] text-[#00ff41]/30">PROJECT INFO</h3>
                        <ReviewRow label="NAME" value={metadata.name} />
                        <ReviewRow label="TICKER" value={metadata.symbol} />
                        <ReviewRow label="DESCRIPTION" value={metadata.description} />
                        {imagePreview || metadata.imageUrl ? (
                            <div className="flex flex-col gap-2 border-b border-[#00ff41]/5 py-1.5 sm:flex-row sm:items-start sm:justify-between">
                                <span className="text-[9px] tracking-[0.15em] text-[#00ff41]/25">IMAGE</span>
                                <div className="relative h-16 w-16 overflow-hidden border border-[#00ff41]/20">
                                    <Image src={imagePreview || metadata.imageUrl || ""} alt="Token" fill className="object-cover" unoptimized />
                                </div>
                            </div>
                        ) : (
                            <ReviewRow label="IMAGE" value="PROVIDED VIA METADATA URL" />
                        )}
                        <ReviewRow label="WEBSITE" value={metadata.website || "-"} />
                        <ReviewRow label="TWITTER / X" value={metadata.twitter || "-"} />
                        <ReviewRow label="TELEGRAM" value={metadata.telegram || "-"} />
                    </div>

                    <div className={reviewPanelClass}>
                        <h3 className="text-[9px] tracking-[0.2em] text-[#00ff41]/30">LAUNCH SETTINGS</h3>
                        <ReviewRow label="LAUNCH TYPE" value={LAUNCH_TYPE_OPTIONS.find((option) => option.id === launchType)?.label || "DEFAULT"} />
                        <ReviewRow label="PARTNER FEE" value={includePartner ? "ENABLED" : "DISABLED"} />
                        <ReviewRow label="ADMIN" value={adminRecipient || "CREATOR WALLET"} />
                        <ReviewRow label="INITIAL BUY" value={initialBuyLamports > 0 ? `${(initialBuyLamports / 1_000_000_000).toFixed(4)} SOL` : "NONE"} />
                        <ReviewRow label="TIP" value={tipLamports > 0 ? `${tipSol || "0"} SOL -> ${tipWallet || "MISSING TIP WALLET"}` : "NONE"} />
                    </div>

                    <div className={reviewPanelClass}>
                        <h3 className="text-[9px] tracking-[0.2em] text-[#00ff41]/30">FEE SHARING</h3>
                        <ReviewRow label="CREATOR SHARE" value={`${creatorBps} BPS`} />
                        <ReviewRow label="EXTRA RECIPIENTS" value={enableFeeSharing ? "ENABLED" : "DISABLED"} />
                        {enableFeeSharing && activeClaimers.length > 0
                            ? activeClaimers.map((claimer, index) => (
                                <ReviewRow
                                    key={`${claimer.recipient}-${index}`}
                                    label={`RECIPIENT ${index + 1}`}
                                    value={`${claimer.recipient} -> ${claimer.resolvedWallet ? shortenAddress(claimer.resolvedWallet) : "UNRESOLVED"} (${claimer.bps} BPS)`}
                                />
                            ))
                            : null}
                    </div>

                    {launchCompany ? (
                        <div className={reviewPanelClass}>
                            <h3 className="text-[9px] tracking-[0.2em] text-[#00ff41]/30">COMPANY INCORPORATION</h3>
                            <ReviewRow label="STATUS" value="ENABLED" />
                            <ReviewRow label="PROJECT NAME" value={incorporationProjectName || metadata.name} />
                            <ReviewRow label="CATEGORY" value={companyCategory} />
                            <ReviewRow label="PROJECT X" value={companyTwitterHandle || "-"} />
                            <ReviewRow label="COMPANY SHARE" value={`${(incorporationShareBps / 100).toFixed(2)}% (${incorporationShareBps} BPS)`} />
                            <ReviewRow label="PREFERRED NAMES" value={preferredCompanyNames.filter(Boolean).join(" / ")} />
                            {founders.map((founder, index) => (
                                <ReviewRow key={`${founder.email}-${index}`} label={`FOUNDER ${index + 1}`} value={`${founder.firstName} ${founder.lastName} - ${founder.email} - ${founder.shareBasisPoint} BPS`} />
                            ))}
                        </div>
                    ) : null}

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                        <button type="button" onClick={() => { setErrorMsg(null); setTxStatus("idle"); setStep(2); }} className={secondaryActionClass}>
                            <ArrowLeft className="h-4 w-4" /> BACK
                        </button>
                        <button type="button" onClick={() => { setErrorMsg(null); setTxStatus("idle"); setStep(4); }} className={primaryActionClass}>
                            LAUNCH <Rocket className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ) : null}

            {step === 4 ? (
                <div className="space-y-6 text-center">
                    {txStatus === "idle" ? (
                        <>
                            <h2 className="text-sm tracking-[0.18em] text-[#dcffe6]">READY TO LAUNCH</h2>
                            {!connected ? (
                                <button onClick={() => setVisible(true)} className={cn(primaryActionClass, "mx-auto w-full px-8 py-3 sm:w-auto")}>
                                    <Wallet className="h-4 w-4" /> CONNECT WALLET AND LAUNCH
                                </button>
                            ) : (
                                <button onClick={executeLaunch} className={cn(primaryActionClass, "mx-auto w-full px-8 py-3 sm:w-auto")}>
                                    <Rocket className="h-4 w-4" /> EXECUTE LAUNCH
                                </button>
                            )}
                        </>
                    ) : null}

                    {["creating-info", "creating-fees", "creating-launch", "creating-company", "signing"].includes(txStatus) ? (
                        <div className="py-12">
                            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#00ff41]/50" />
                            <p className="text-[10px] tracking-wider text-[#00ff41]/40">
                                {txStatus === "creating-info" && "CREATING TOKEN INFO AND METADATA..."}
                                {txStatus === "creating-fees" && "CREATING FEE SHARE CONFIG..."}
                                {txStatus === "creating-launch" && "CREATING LAUNCH TRANSACTION..."}
                                {txStatus === "creating-company" && "STARTING COMPANY INCORPORATION FLOW..."}
                                {txStatus === "signing" && "AWAITING WALLET SIGNATURE..."}
                            </p>
                        </div>
                    ) : null}

                    {txStatus === "success" ? (
                        <div className="space-y-4 py-8">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center border-2 border-[#00ff41]/50 bg-[#00ff41]/10"><Check className="h-8 w-8 text-[#00ff41]" /></div>
                            <h2 className="text-sm tracking-[0.2em] text-[#00ff41]">TOKEN LAUNCHED</h2>
                            {companyNotice ? (
                                <div className={cn("mx-auto max-w-xl border p-3 text-[10px] tracking-wider", /needs attention/i.test(companyNotice) ? "border-[#ffb347]/20 bg-[#ffb347]/5 text-[#ffb347]/70" : "border-[#8dd8ff]/20 bg-[#8dd8ff]/5 text-[#8dd8ff]/70")}>
                                    {companyNotice}
                                </div>
                            ) : null}
                            {tokenMint ? (
                                <div className="space-y-2">
                                    <p className="text-[9px] tracking-wider text-[#00ff41]/30">TOKEN MINT</p>
                                    <p className="break-all border border-[#00ff41]/15 bg-black/60 p-2 text-[10px] tracking-wider text-[#00ff41]/60">{tokenMint}</p>
                                    <Link href={`/token/${tokenMint}`} className={cn(primaryActionClass, "mt-2")}>
                                        VIEW TOKEN <ExternalLink className="h-4 w-4" />
                                    </Link>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {txStatus === "error" ? (
                        <div className="space-y-4 py-8">
                            <AlertCircle className="mx-auto h-12 w-12 text-[#ff4400]/40" />
                            <h2 className="text-sm tracking-[0.18em] text-[#ff885c]">LAUNCH FAILED</h2>
                            {errorMsg ? <p className="mx-auto max-w-md border border-[#ff6d42]/30 bg-[#ff4400]/10 p-3 text-[10px] tracking-wider text-[#ffc0ab]">{errorMsg}</p> : null}
                            <button onClick={() => { setTxStatus("idle"); setErrorMsg(null); }} className={secondaryActionClass}>
                                TRY AGAIN
                            </button>
                        </div>
                    ) : null}

                    {txStatus !== "success" ? (
                        <button onClick={() => setStep(3)} className="text-[10px] tracking-wider text-[#8fe8a8]/45 transition-colors hover:text-[#e8fff0]">
                            BACK TO REVIEW
                        </button>
                    ) : null}
                </div>
            ) : null}

            {errorMsg && step !== 4 ? (
                <div className="mt-4 border border-[#ff6d42]/30 bg-[#ff4400]/10 p-3 text-[10px] tracking-wider text-[#ffd0bf] shadow-[0_0_18px_rgba(255,68,0,0.07)]">
                    {errorMsg}
                </div>
            ) : null}
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
            <label className="mb-1 block text-[9px] tracking-[0.2em] text-[#8fe8a8]/75">{label}</label>
            {children}
            {error ? <p className="mt-1 text-[9px] tracking-wider text-[#ffb19b]">{error}</p> : null}
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
        <div className="border border-[#2dff79]/18 bg-[#04120b]/82 p-3 shadow-[0_0_14px_rgba(0,255,65,0.04)]">
            <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-wider text-[#9affb7]/65">{label}</span>
                <span className={cn("text-xs tracking-wider", invalid ? "text-[#ff9c7a]" : "text-[#e4ffeb]")}>{value}</span>
            </div>
            <p className="mt-1 text-[8px] tracking-wider text-[#94d8a7]/55">{note}</p>
        </div>
    );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1 border-b border-[#00ff41]/10 py-1.5 last:border-0 sm:flex-row sm:items-start sm:justify-between">
            <span className="flex-shrink-0 text-[9px] tracking-[0.15em] text-[#8fe8a8]/70">{label}</span>
            <span className="break-all text-left text-[10px] tracking-wider text-[#e0ffe8] sm:ml-4 sm:text-right">{value}</span>
        </div>
    );
}

function createFounderInput(shareBasisPoint: number): FounderInput {
    return {
        firstName: "",
        lastName: "",
        email: "",
        nationalityCountry: "",
        taxResidencyCountry: "",
        residentialAddress: "",
        shareBasisPoint,
    };
}

function createPreferredCompanyNames(projectName: string) {
    const clean = projectName.trim();
    if (!clean) {
        return ["", "", ""];
    }
    return [`${clean} Labs`, `${clean} Holdings`, `${clean} Foundation`];
}

function normalizeTwitterInput(value?: string) {
    const trimmed = value?.trim() || "";
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const handle = trimmed.replace(/^@/, "");
    return handle ? `https://x.com/${handle}` : "";
}

function normalizeTelegramInput(value?: string) {
    const trimmed = value?.trim() || "";
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const handle = trimmed.replace(/^@/, "");
    return handle ? `https://t.me/${handle}` : "";
}

function extractTwitterHandle(value?: string | null) {
    const trimmed = value?.trim() || "";
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const url = new URL(trimmed);
            const segment = url.pathname.split("/").filter(Boolean)[0];
            return segment ? segment.replace(/^@/, "") : null;
        } catch {
            return null;
        }
    }
    return trimmed.replace(/^@/, "");
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
