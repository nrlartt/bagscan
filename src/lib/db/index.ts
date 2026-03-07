import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as { prisma?: PrismaClient };

export const prisma = new Proxy({} as PrismaClient, {
    get: (target, prop) => {
        if (!globalForPrisma.prisma) {
            const adapter = new PrismaBetterSqlite3({
                url: process.env.DATABASE_URL || "file:./dev.db",
            });
            globalForPrisma.prisma = new PrismaClient({ adapter });
        }
        return (globalForPrisma.prisma as any)[prop];
    },
});
