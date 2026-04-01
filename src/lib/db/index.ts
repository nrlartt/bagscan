import { createRequire } from "module";
import type { PrismaClient } from "@prisma/client";
import type { Pool } from "pg";

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

function getPrismaClient(): PrismaClient {
    if (!globalForPrisma.prisma) {
        const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
        const { PrismaPg } = require("@prisma/adapter-pg") as { PrismaPg: typeof import("@prisma/adapter-pg").PrismaPg };
        const { Pool } = require("pg") as typeof import("pg");
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error("DATABASE_URL is not configured");
        }

        const normalizedConnectionString = normalizeConnectionString(connectionString);

        globalForPrisma.prismaPool =
            globalForPrisma.prismaPool ||
            new Pool({
                connectionString: normalizedConnectionString,
            });

        const adapter = new PrismaPg(globalForPrisma.prismaPool);
        globalForPrisma.prisma = new PrismaClient({ adapter });
    }

    return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
    get: (_target, prop, receiver) => Reflect.get(getPrismaClient(), prop, receiver),
});
