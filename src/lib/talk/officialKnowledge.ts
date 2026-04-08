export interface OfficialKnowledgeLink {
    label: string;
    href: string;
}

export interface OfficialKnowledgeEntry {
    id: string;
    title: string;
    summary: string;
    bullets: string[];
    suggestions: string[];
    links: OfficialKnowledgeLink[];
    patterns: RegExp[];
}

const DOCS_ROOT = "https://docs.bags.fm/";
const FAQ_ROOT = "https://support.bags.fm/en/collections/18014326-faqs";

const OFFICIAL_KNOWLEDGE_ENTRIES: OfficialKnowledgeEntry[] = [
    {
        id: "docs-hub",
        title: "OFFICIAL BAGS DOCS HUB",
        summary: "This answer stays inside official Bags docs and FAQ material, without BagScan rankings or interpretation layers.",
        bullets: [
            "The main docs portal is docs.bags.fm and the FAQ/help center lives on support.bags.fm.",
            "Use the docs for launch, fee sharing, partner flows, SDK usage, and API authentication details.",
            "Use the help center for claims, failed transactions, security basics, and how to contact support.",
        ],
        suggestions: [
            "How do I launch a token on BAGS?",
            "How do partner keys work on Bags?",
            "How do I claim fees on Bags?",
            "How do I contact Bags support?",
        ],
        links: [
            { label: "Open Docs", href: DOCS_ROOT },
            { label: "Open FAQs", href: FAQ_ROOT },
            { label: "API Docs FAQ", href: "https://support.bags.fm/en/articles/13434624-api-docs" },
        ],
        patterns: [
            /\b(api docs?|documentation|docs?|faq|help center|knowledge base|support articles?)\b/i,
        ],
    },
    {
        id: "what-is-bags",
        title: "WHAT IS BAGS?",
        summary: "Bags describes itself as a financial messenger for traders, combining chat and trading in one Solana-native product.",
        bullets: [
            "The official help center positions Bags as a place to trade and chat without juggling separate wallet, app, and browser flows.",
            "The same official overview highlights trending discovery, embedded wallet flows, creator monetization, and referrals.",
            "This is product positioning from the official Bags help center, not BagScan commentary.",
        ],
        suggestions: [
            "Where are the official Bags API docs?",
            "How do I launch a token on BAGS?",
            "How do I contact Bags support?",
        ],
        links: [
            { label: "What Is Bags?", href: "https://support.bags.fm/en/articles/10439755-what-is-bags" },
            { label: "Open Bags", href: "https://bags.fm" },
        ],
        patterns: [
            /\bwhat is bags\b/i,
            /\bhow does bags work\b/i,
            /\bwhat does bags do\b/i,
        ],
    },
    {
        id: "api-docs",
        title: "OFFICIAL BAGS API DOCS",
        summary: "Official Bags API access starts with an API key from dev.bags.fm, then every request authenticates with the x-api-key header.",
        bullets: [
            "The official docs say API keys are created in the Bags Developer Portal at dev.bags.fm.",
            "The docs root covers authentication, rate limits, SDK usage, and first API calls.",
            "The help center points directly to docs.bags.fm as the official API documentation home.",
        ],
        suggestions: [
            "How do I launch a token on BAGS?",
            "How do partner keys work on Bags?",
            "How do I claim partner fees?",
        ],
        links: [
            { label: "Open Docs", href: DOCS_ROOT },
            { label: "API Docs FAQ", href: "https://support.bags.fm/en/articles/13434624-api-docs" },
            { label: "Developer Portal", href: "https://dev.bags.fm" },
        ],
        patterns: [
            /\b(api key|api keys|x-api-key|developer portal|dev\.bags\.fm|sdk|typescript setup|node setup)\b/i,
            /\b(api docs?|developer docs?|bags api)\b/i,
        ],
    },
    {
        id: "launch-token",
        title: "OFFICIAL BAGS LAUNCH FLOW",
        summary: "The official Launch Token v2 flow is metadata first, fee-share config second, launch transaction third, then wallet signing and broadcast.",
        bullets: [
            "The official guide lists the core order as: create metadata, create config, get token creation transaction, sign, and broadcast.",
            "The docs say Launch v2 requires explicit fee sharing, with the creator included explicitly in the BPS allocation.",
            "The guide also expects an API key, SOL for transactions, and token media/social inputs before launch.",
        ],
        suggestions: [
            "How does fee sharing work on Bags?",
            "How do partner keys work on Bags?",
            "What should I do if a Bags transaction fails?",
        ],
        links: [
            { label: "Launch Token Guide", href: "https://docs.bags.fm/how-to-guides/launch-token" },
            { label: "Open Launch", href: "https://bags.fm/launch" },
            { label: "Open Docs", href: DOCS_ROOT },
        ],
        patterns: [
            /\b(how do i launch|launch a token|token launch|create token|deploy token|launch flow)\b/i,
        ],
    },
    {
        id: "launch-settings",
        title: "OFFICIAL LAUNCH SETTINGS",
        summary: "Founder mode, admin settings, fee sharing, and company launch options belong to the official Bags launch surface and should be verified on the live launch screen before signing.",
        bullets: [
            "The live Bags launch UI is the source of truth for current launch-type wording and which settings are available.",
            "Admin, fee sharing, and company options are part of the official launch configuration surface, not a separate BagScan layer.",
            "If you are about to sign, the safest practice is to verify the exact mode and review state on the launch screen itself.",
        ],
        suggestions: [
            "How do I launch a token on BAGS?",
            "How does fee sharing work on Bags?",
            "How does company incorporation work on Bags?",
        ],
        links: [
            { label: "Open Launch", href: "https://bags.fm/launch" },
            { label: "Launch Token Guide", href: "https://docs.bags.fm/how-to-guides/launch-token" },
        ],
        patterns: [
            /\b(founder mode|paper hand tax mode|admin settings|launch type|launch settings)\b/i,
        ],
    },
    {
        id: "fee-sharing",
        title: "OFFICIAL FEE SHARING RULES",
        summary: "Official Bags Launch v2 fee sharing uses explicit BPS allocation, and the creator must be included explicitly in that configuration.",
        bullets: [
            "The Launch Token guide says the total BPS across creator and all fee claimers must equal exactly 10,000.",
            "The official docs allow up to 100 fee earners, and more than 15 claimers requires lookup table handling.",
            "Supported social-provider lookups in the official guide include twitter, kick, and github.",
        ],
        suggestions: [
            "How do partner keys work on Bags?",
            "How do I launch a token on BAGS?",
            "How do I claim fees on Bags?",
        ],
        links: [
            { label: "Launch Token Guide", href: "https://docs.bags.fm/how-to-guides/launch-token" },
            { label: "Open Launch", href: "https://bags.fm/launch" },
        ],
        patterns: [
            /\b(fee share|fee sharing|fee split|fee claimer|claimers|bps|basis points|lookup table|lut)\b/i,
        ],
    },
    {
        id: "partner-key",
        title: "OFFICIAL PARTNER KEY FLOW",
        summary: "A Bags partner key is a partner configuration used for fee sharing across launches, with one partner key allowed per wallet.",
        bullets: [
            "The official guide says each wallet can create only one partner key, and multiple keys require multiple wallets.",
            "By default, partner keys receive 25% of fees, or 2,500 bps, unless Bags configures a custom percentage for the account.",
            "You can create the partner key either in the dev dashboard or with the official TypeScript SDK.",
        ],
        suggestions: [
            "How do I claim partner fees?",
            "How does fee sharing work on Bags?",
            "How do I launch a token on BAGS?",
        ],
        links: [
            { label: "Create Partner Key", href: "https://docs.bags.fm/how-to-guides/create-partner-key" },
            { label: "Developer Portal", href: "https://dev.bags.fm" },
        ],
        patterns: [
            /\b(partner key|partner config|partner configuration|partner pda|create partner)\b/i,
        ],
    },
    {
        id: "partner-fees",
        title: "OFFICIAL PARTNER FEE CLAIMING",
        summary: "Partner fee claiming on Bags starts by checking partner claim stats, then generating and sending the official claim transactions.",
        bullets: [
            "The official guide says unclaimed partner fees can be checked in the dev dashboard or with the SDK.",
            "Partners need SOL for the transaction sequence because the final vault-withdraw step only succeeds after the earlier source claim steps.",
            "The guide recommends checking stats first, then generating claim transactions, then signing and sending them in order.",
        ],
        suggestions: [
            "How do partner keys work on Bags?",
            "How do I claim fees on Bags?",
            "What should I do if a Bags transaction fails?",
        ],
        links: [
            { label: "Claim Partner Fees", href: "https://docs.bags.fm/how-to-guides/claim-partner-fees" },
            { label: "Create Partner Key", href: "https://docs.bags.fm/how-to-guides/create-partner-key" },
        ],
        patterns: [
            /\b(claim partner fees|partner fee|partner fees|partner claim|unclaimed partner)\b/i,
        ],
    },
    {
        id: "claim-fees",
        title: "OFFICIAL USER FEE CLAIMING",
        summary: "The official Bags help flow for claiming fees is: verify with X, open your profile, then use the green Claim button next to the eligible token.",
        bullets: [
            "The help center says claims are handled from your profile after signing in with X.",
            "If rewards are available, the token row shows a green Claim button.",
            "This is end-user claim guidance from the help center, separate from developer partner-fee claiming.",
        ],
        suggestions: [
            "How do I contact Bags support?",
            "What should I do if a Bags transaction fails?",
            "How do partner keys work on Bags?",
        ],
        links: [
            { label: "Claim Fees FAQ", href: "https://support.bags.fm/en/articles/13434893-claim-fees" },
            { label: "Open Bags", href: "https://bags.fm" },
        ],
        patterns: [
            /\b(claim fees|how do i claim|green claim button|rewards to claim|claim my fees)\b/i,
        ],
    },
    {
        id: "company-incorporation",
        title: "OFFICIAL COMPANY INCORPORATION",
        summary: "Company launch and incorporation are part of the official Bags launch surface, and the API now exposes incorporation start, payment, company listing, and company token detail flows.",
        bullets: [
            "BagScan can wire into the official Bags incorporation flow when company launch is enabled on the launch surface.",
            "The official API release added endpoints for starting incorporation, paying for it, listing incorporated companies, and reading company token details.",
            "The live launch UI is the safest place to verify whether company launch is enabled for the current flow before signing.",
        ],
        suggestions: [
            "How do I launch a token on BAGS?",
            "What launch settings are available on Bags?",
            "Where are the official Bags API docs?",
        ],
        links: [
            { label: "Open Launch", href: "https://bags.fm/launch" },
            { label: "Open Docs", href: DOCS_ROOT },
        ],
        patterns: [
            /\b(company|incorporation|launch a company|incorporated companies|company token details)\b/i,
        ],
    },
    {
        id: "transaction-failed",
        title: "OFFICIAL TRANSACTION TROUBLESHOOTING",
        summary: "The official Bags help center says the most common failed-transaction causes are insufficient SOL, temporary Solana congestion, or temporary network issues.",
        bullets: [
            "The recommended checks are: make sure the wallet has enough SOL for fees, retry the transaction, and verify current Solana network conditions.",
            "The help center also says failed transactions do not mean funds are lost; the funds stay in the wallet if the transaction did not process.",
            "If the issue keeps happening, the official guidance is to reach out to Bags support.",
        ],
        suggestions: [
            "How do I contact Bags support?",
            "How do I claim fees on Bags?",
            "How do I launch a token on BAGS?",
        ],
        links: [
            { label: "Transaction Q&A", href: "https://support.bags.fm/en/articles/10439772-transaction-related-q-a" },
            { label: "Open Bags", href: "https://bags.fm" },
        ],
        patterns: [
            /\b(failed transaction|transaction failed|why did my transaction fail|insufficient sol|network congestion|funds safe)\b/i,
        ],
    },
    {
        id: "support-contact",
        title: "OFFICIAL SUPPORT CONTACT",
        summary: "The official Bags help center says support is reached from the chat icon in the bottom-right corner.",
        bullets: [
            "The support article is very short and points users directly to the in-app/site chat icon.",
            "If you are dealing with repeated transaction or account issues, this is the official support route.",
        ],
        suggestions: [
            "What should I do if a Bags transaction fails?",
            "How do I claim fees on Bags?",
            "Where are the official Bags API docs?",
        ],
        links: [
            { label: "How To Contact Support", href: "https://support.bags.fm/en/articles/10008634-how-to-contact-support" },
            { label: "Open Bags Support", href: "https://support.bags.fm/en/" },
        ],
        patterns: [
            /\b(contact support|support|bags support|help me reach support)\b/i,
        ],
    },
    {
        id: "wallet-security",
        title: "OFFICIAL WALLET SECURITY BASICS",
        summary: "The official Bags help center is explicit: never share a private key or seed phrase with anyone.",
        bullets: [
            "A seed phrase restores an entire wallet, while a private key controls a specific wallet address.",
            "Anyone with either secret can control the wallet, so both must stay private and stored securely.",
            "If either secret has already been exposed, the safe response is to move assets to a new secure wallet.",
        ],
        suggestions: [
            "How do I contact Bags support?",
            "Where are the official Bags API docs?",
            "What is Bags?",
        ],
        links: [
            { label: "Private Key vs Seed Phrase", href: "https://support.bags.fm/en/articles/13434863-private-key-vs-seed-phrase" },
            { label: "Open Bags Support", href: "https://support.bags.fm/en/" },
        ],
        patterns: [
            /\b(private key|seed phrase|recovery phrase|wallet security)\b/i,
        ],
    },
    {
        id: "withdraw-fiat",
        title: "OFFICIAL FIAT WITHDRAWAL GUIDANCE",
        summary: "The official Bags help center says fiat withdrawal is done by sending SOL to a centralized exchange, then converting and withdrawing there.",
        bullets: [
            "The help article points to CEX flows such as Binance, Coinbase, or Kraken for bank withdrawals.",
            "The recommended path is: get the CEX Solana address, send SOL from Bags, sell it there, then withdraw fiat from the exchange.",
            "The help center also warns that blockchain transfers are irreversible, so the destination address must be checked carefully.",
        ],
        suggestions: [
            "How do I contact Bags support?",
            "What should I do if a Bags transaction fails?",
            "What is Bags?",
        ],
        links: [
            { label: "Withdraw To Fiat", href: "https://support.bags.fm/en/articles/13434678-withdraw-to-fiat" },
            { label: "Open Bags", href: "https://bags.fm" },
        ],
        patterns: [
            /\b(withdraw to fiat|cash out|withdraw fiat|convert.*fiat|send to exchange|cex)\b/i,
        ],
    },
];

export function findOfficialKnowledgeEntry(message: string) {
    const lowered = message.trim().toLowerCase();
    let best: { score: number; entry: OfficialKnowledgeEntry } | null = null;

    for (const entry of OFFICIAL_KNOWLEDGE_ENTRIES) {
        let score = 0;
        for (const pattern of entry.patterns) {
            if (pattern.test(lowered)) {
                score += 1;
            }
        }

        if (score === 0) continue;
        if (!best || score > best.score) {
            best = { score, entry };
        }
    }

    return best?.entry;
}

export function getOfficialKnowledgeEntry(id: string) {
    return OFFICIAL_KNOWLEDGE_ENTRIES.find((entry) => entry.id === id);
}

export function getOfficialKnowledgeHub() {
    return getOfficialKnowledgeEntry("docs-hub")!;
}
