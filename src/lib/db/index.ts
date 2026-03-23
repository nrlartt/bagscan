import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as { prisma?: PrismaClient; prismaPool?: Pool };

function getPrismaClient(): PrismaClient {
    if (!globalForPrisma.prisma) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error("DATABASE_URL is not configured");
        }

        globalForPrisma.prismaPool =
            globalForPrisma.prismaPool ||
            new Pool({
                connectionString,
            });

        const adapter = new PrismaPg(globalForPrisma.prismaPool);
        globalForPrisma.prisma = new PrismaClient({ adapter });
    }

    return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
    get: (_target, prop, receiver) => Reflect.get(getPrismaClient(), prop, receiver),
});
