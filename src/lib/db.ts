import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  // PrismaNeonHttp uses HTTP transport — works on Vercel serverless without WebSockets
  const adapter = new PrismaNeonHttp(process.env.DATABASE_URL!, {
    arrayMode: false,
    fullResults: false,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
