import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDueTrialEmailStep, sendTrialEmail, type TrialEmailUser } from "@/lib/trial-emails";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const expected = process.env.CRON_SECRET || process.env.TRIAL_EMAIL_CRON_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization") || "";
  const header = req.headers.get("x-cron-secret") || "";
  return auth === `Bearer ${expected}` || header === expected;
}

function isPaidOrComped(user: TrialEmailUser) {
  if (!user.organization) return false;
  if (user.organization.plan && user.organization.plan !== "free") return true;
  return user.organization.camps.some(camp => ["active", "comped"].includes((camp as { billingStatus?: string }).billingStatus || ""));
}

export async function GET(req: NextRequest) {
  return runTrialEmails(req);
}

export async function POST(req: NextRequest) {
  return runTrialEmails(req);
}

async function runTrialEmails(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1" || url.searchParams.get("dryRun") === "true";
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const now = new Date();
  const featureCutoff = new Date(process.env.TRIAL_EMAILS_START_AT || "2026-07-05T10:44:00.000Z");
  const rollingCutoff = new Date(now.getTime() - 30 * 86_400_000);
  const oldest = featureCutoff > rollingCutoff ? featureCutoff : rollingCutoff;

  const users = await prisma.user.findMany({
    where: {
      email: { not: "" },
      createdAt: { gte: oldest },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      organization: {
        include: {
          camps: {
            select: {
              id: true,
              name: true,
              billingStatus: true,
              ageGroups: { select: { id: true } },
              courses: { select: { id: true } },
              sessionTemplates: { select: { id: true } },
              registrationForms: { select: { id: true } },
              campers: { select: { id: true } },
            },
          },
        },
      },
      trialEmailLogs: { select: { step: true } },
    },
  });

  const results: Array<{ userId: string; email: string; step?: string; action: string; error?: string }> = [];

  for (const user of users) {
    const typedUser = user as unknown as TrialEmailUser;
    if (isPaidOrComped(typedUser)) {
      results.push({ userId: user.id, email: user.email, action: "skipped_paid_or_comped" });
      continue;
    }

    const sent = new Set(user.trialEmailLogs.map(log => log.step));
    const due = getDueTrialEmailStep(typedUser, sent, now);
    if (!due) {
      results.push({ userId: user.id, email: user.email, action: "no_email_due" });
      continue;
    }

    if (dryRun) {
      results.push({ userId: user.id, email: user.email, step: due.step, action: "would_send" });
      continue;
    }

    try {
      const sendResult = await sendTrialEmail(typedUser, due.step);
      results.push({ userId: user.id, email: user.email, step: due.step, action: sendResult.sent ? "sent" : "skipped" });
    } catch (error) {
      console.error("Trial email send failed:", user.email, due.step, error);
      results.push({ userId: user.id, email: user.email, step: due.step, action: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({ ok: true, dryRun, checked: users.length, results });
}
