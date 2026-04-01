import { createRequire } from "module";
import type { PrismaClient } from "@prisma/client";
import type { Pool, PoolClient } from "pg";

const require = createRequire(import.meta.url);

const globalForPrisma = globalThis as { prisma?: PrismaClient; prismaPool?: Pool };

function normalizeConnectionString(connectionString: string) {
    try {
        const url = new URL(connectionString);

        if (url.hostname.includes("pooler.supabase.com")) {
            if (!url.searchParams.has("sslmode")) {
                url.searchParams.set("sslmode", "require");
            }

            if (!url.searchParams.has("connect_timeout")) {
                url.searchParams.set("connect_timeout", "30");
            }

            if (!url.searchParams.has("uselibpqcompat")) {
                url.searchParams.set("uselibpqcompat", "true");
            }
        }

        return url.toString();
    } catch {
        return connectionString;
    }
}

function getConnectionString() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is not configured");
    }

    return normalizeConnectionString(connectionString);
}

export function getPgPool(): Pool {
    if (!globalForPrisma.prismaPool) {
        const { Pool } = require("pg") as typeof import("pg");
        globalForPrisma.prismaPool = new Pool({
            connectionString: getConnectionString(),
        });
    }

    return globalForPrisma.prismaPool;
}

export async function withPgAdvisoryLock<T>(
    lockKey: number,
    work: () => Promise<T>
): Promise<{ acquired: false } | { acquired: true; result: T }> {
    const pool = getPgPool();
    const client = await pool.connect();

    try {
        const result = await client.query<{ acquired: boolean }>(
            "SELECT pg_try_advisory_lock($1) AS acquired",
            [lockKey]
        );

        if (!result.rows[0]?.acquired) {
            return { acquired: false };
        }

        try {
            const workResult = await work();
            return { acquired: true, result: workResult };
        } finally {
            await client
                .query("SELECT pg_advisory_unlock($1)", [lockKey])
                .catch(() => undefined);
        }
    } finally {
        (client as PoolClient).release();
    }
}

function getPrismaClient(): PrismaClient {
    if (!globalForPrisma.prisma) {
        const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
        const { PrismaPg } = require("@prisma/adapter-pg") as { PrismaPg: typeof import("@prisma/adapter-pg").PrismaPg };
        const adapter = new PrismaPg(getPgPool());
        globalForPrisma.prisma = new PrismaClient({ adapter });
    }

    return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
    get: (_target, prop, receiver) => Reflect.get(getPrismaClient(), prop, receiver),
});
