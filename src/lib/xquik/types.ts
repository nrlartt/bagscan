/* ──────────────────────────────────────────────
   Xquik (X/Twitter) API – Type definitions
   https://docs.xquik.com/api-reference/overview
   ────────────────────────────────────────────── */

export interface XquikTweet {
    id: string;
    text: string;
    createdAt?: string;
    likeCount?: number;
    retweetCount?: number;
    replyCount?: number;
    author?: XquikAuthor;
    media?: XquikMedia[];
}

export interface XquikAuthor {
    id: string;
    username: string;
    name: string;
    verified?: boolean;
}

export interface XquikMedia {
    mediaUrl: string;
    type: "photo" | "video" | "animated_gif";
    url?: string;
}

export interface XquikSearchResponse {
    tweets: XquikTweet[];
    total: number;
}

export interface XquikUser {
    id: string;
    username: string;
    name: string;
    description?: string;
    followers?: number;
    following?: number;
    verified?: boolean;
    profilePicture?: string;
    location?: string;
    createdAt?: string;
    statusesCount?: number;
}

export interface XquikRadarItem {
    id: string;
    title: string;
    description?: string;
    url?: string;
    imageUrl?: string;
    source: "google_trends" | "hacker_news" | "trustmrr" | "wikipedia" | "github" | "reddit";
    sourceId: string;
    category: string;
    region: string;
    language: string;
    score: number;
    metadata?: Record<string, unknown>;
    publishedAt: string;
    createdAt: string;
}

export interface XquikRadarResponse {
    items: XquikRadarItem[];
    hasMore: boolean;
    nextCursor?: string;
}
