import { createHmac, randomInt } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000;

/** Shared PostgreSQL limiter across serverless instances. Never stores a raw IP or email. */
export async function checkAuthThrottle(req: NextRequest, identity: string, action: "login" | "signup"): Promise<boolean> {
  const secret = process.env.AUTH_SECRET || (process.env.NODE_ENV !== "production" ? process.env.JWT_SECRET : undefined);
  if (!secret || secret.length < 32) throw new Error("Authentication throttle secret missing");
  const ip = (req.headers.get("x-vercel-forwarded-for") || req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim().slice(0, 64);
  const window = Math.floor(Date.now() / WINDOW_MS);
  const expiresAt = new Date((window + 1) * WINDOW_MS);
  const hash = (subject: string) => createHmac("sha256", secret).update(subject).digest("hex");
  const limits: Array<[string, number]> = action === "login"
    ? [[`ip:${ip}`, 100], [`pair:${ip}:${identity}`, 10]]
    : [[`ip:${ip}`, 20], [`pair:${ip}:${identity}`, 3]];
  let allowed = true;
  for (const [subject, max] of limits) {
    const id = hash(`${action}:${window}:${subject}`);
    const rows = await prisma.$queryRaw<Array<{ attempts: number }>>`
      INSERT INTO "AuthThrottle" ("id", "attempts", "expiresAt") VALUES (${id}, 1, ${expiresAt})
      ON CONFLICT ("id") DO UPDATE SET "attempts" = "AuthThrottle"."attempts" + 1
      RETURNING "attempts"`;
    if (!rows[0] || rows[0].attempts > max) allowed = false;
  }
  // Opportunistic cleanup also works when the scheduled maintenance job is delayed.
  if (randomInt(100) === 0) {
    await prisma.$executeRaw`DELETE FROM "AuthThrottle" WHERE "expiresAt" < NOW() - INTERVAL '1 day'`;
  }
  return allowed;
}
