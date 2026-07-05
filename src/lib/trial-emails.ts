import { prisma } from "@/lib/db";
import { getBaseUrl } from "@/lib/billing";
import { FROM_EMAIL, getResend } from "@/lib/email";

export const TRIAL_LENGTH_DAYS = 14;

export type TrialEmailStep =
  | "welcome"
  | "setup_day_1"
  | "registration_day_3"
  | "schedule_day_5"
  | "halfway_day_7"
  | "expires_3_days"
  | "expires_tomorrow"
  | "expired"
  | "rescue_day_17";

export type TrialEmailUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  organization?: {
    id: string;
    name: string;
    plan: string;
    camps: Array<{
      id: string;
      name: string;
      billingStatus?: string;
      ageGroups: { id: string }[];
      courses: { id: string }[];
      sessionTemplates: { id: string }[];
      registrationForms: { id: string }[];
      campers: { id: string }[];
    }>;
  } | null;
};

type TrialEmailDefinition = {
  step: TrialEmailStep;
  day: number;
  subject: string;
  preview: string;
  heading: string;
  intro: string;
  bullets: string[];
  ctaLabel: string;
  ctaPath: string;
  footer?: string;
};

export const TRIAL_EMAIL_SEQUENCE: TrialEmailDefinition[] = [
  {
    step: "welcome",
    day: 0,
    subject: "Welcome to Camp Creator Pro - your 14-day trial is live",
    preview: "Your no-card trial is active. Start by building your first camp setup.",
    heading: "Your camp command center is ready.",
    intro: "Welcome to Camp Creator Pro. Your 14-day free trial is active, and no credit card is required. The fastest way to see the value is to build your first camp setup.",
    bullets: ["Add your camp name and dates", "Create age groups", "Add rooms, teachers, and activities", "Build your schedule", "Open registration when you are ready"],
    ctaLabel: "Set up your camp",
    ctaPath: "/setup",
    footer: "You are also eligible for the Founding Camp Offer: 50% off your first year if you upgrade during the launch period.",
  },
  {
    step: "setup_day_1",
    day: 1,
    subject: "Your simple camp setup checklist",
    preview: "Do these first to get your camp ready faster.",
    heading: "Do these 5 things first.",
    intro: "To get the most out of your trial, focus on the setup pieces that make everything else click together.",
    bullets: ["Add your camp info", "Create age groups", "Add rooms and teachers", "Add activities/classes", "Build your schedule", "Preview registration"],
    ctaLabel: "Open setup checklist",
    ctaPath: "/setup",
    footer: "Need to start small? Add one age group, one teacher, and a few activities. Momentum beats perfection.",
  },
  {
    step: "registration_day_3",
    day: 3,
    subject: "Ready to build your registration form?",
    preview: "Turn your setup into a parent-ready registration form.",
    heading: "Show parents a form that feeds the rest of camp.",
    intro: "Once your basic setup is in place, the next big win is your registration form. Registration connects directly to camper records, class counts, and your schedule.",
    bullets: ["Camper and guardian info", "Emergency contacts", "Custom questions", "Age group selection", "Class choices", "Payments if needed", "Confirmation emails"],
    ctaLabel: "Build your registration form",
    ctaPath: "/registration",
    footer: "Tip: Start with the essentials. You can always add custom questions later.",
  },
  {
    step: "schedule_day_5",
    day: 5,
    subject: "Your schedule can do more than sit in a spreadsheet",
    preview: "Connect activities, teachers, rooms, time slots, and age groups.",
    heading: "Build a schedule staff and families can actually use.",
    intro: "A registration form is helpful. A registration form connected to a real camp schedule is where the magic starts.",
    bullets: ["Time slots", "Rooms", "Teachers", "Activities", "Age groups", "Required sessions", "Class choices", "Capacity limits"],
    ctaLabel: "Open Schedule Builder",
    ctaPath: "/schedule",
    footer: "If you only have 10 minutes today, add one day of time slots and a few activities.",
  },
  {
    step: "halfway_day_7",
    day: 7,
    subject: "You are halfway through your trial",
    preview: "7 days left. Here is what to finish next.",
    heading: "You are halfway through your 14-day trial.",
    intro: "If you have already started setup, now is a great time to finish the pieces that turn Camp Creator Pro into your real camp workflow.",
    bullets: ["Camp setup", "Activities/classes", "Schedule", "Registration form", "Confirmation email", "Check-in and print tools"],
    ctaLabel: "Continue your camp setup",
    ctaPath: "/dashboard",
    footer: "And remember: founding customers get 50% off the first year during the launch period.",
  },
  {
    step: "expires_3_days",
    day: 11,
    subject: "Your trial ends in 3 days",
    preview: "Keep your camp setup active with 50% off your first year.",
    heading: "Your Camp Creator Pro trial ends in 3 days.",
    intro: "If Camp Creator Pro is helping you simplify registration, scheduling, check-in, or print materials, now is a good time to choose a plan.",
    bullets: ["Launch: $299/year, $149.50 first year", "Camp Pro: $799/year, $399.50 first year", "Organization: $1,499/year, $749.50 first year", "Paid registrations include a simple 3% platform fee, usually paid by the registrant"],
    ctaLabel: "View plans",
    ctaPath: "/#pricing",
    footer: "Free registrations and scholarship-only registrations stay free.",
  },
  {
    step: "expires_tomorrow",
    day: 13,
    subject: "Your trial ends tomorrow",
    preview: "Last day to keep your camp moving without interruption.",
    heading: "Quick reminder: your trial ends tomorrow.",
    intro: "If you want to keep working on setup, registration forms, schedules, rosters, check-in, and print tools, choose a plan before the trial closes.",
    bullets: ["Founding customers get 50% off the first year", "Monthly plans start at $29/month", "Yearly plans start at $299/year", "Your camp setup stays connected when you upgrade"],
    ctaLabel: "Keep your camp active",
    ctaPath: "/#pricing",
    footer: "Do not let a good camp setup wander into the wilderness like an unattended permission slip.",
  },
  {
    step: "expired",
    day: 14,
    subject: "Your Camp Creator Pro trial has ended",
    preview: "Reactivate your account and keep your setup moving.",
    heading: "Your 14-day trial has ended.",
    intro: "Your setup work is still worth protecting. Your camp info, activities, registration setup, and schedule can keep moving when you choose a plan.",
    bullets: ["Launch: $149.50 first year", "Camp Pro: $399.50 first year", "Organization: $749.50 first year", "3% paid-registration platform fee, usually paid by registrants"],
    ctaLabel: "Choose a plan",
    ctaPath: "/#pricing",
    footer: "We are building this for real camp directors, real volunteers, real families, and the heroic people trying to avoid one more spreadsheet.",
  },
  {
    step: "rescue_day_17",
    day: 17,
    subject: "Need more time with Camp Creator Pro?",
    preview: "Come back and finish your camp setup.",
    heading: "Still thinking it over?",
    intro: "If you did not get enough time to finish your setup, we understand. Camp season has a way of turning every day into a dodgeball tournament for your attention.",
    bullets: ["Review your camp setup", "Finish registration", "Test a sample camper registration", "Try check-in and print tools", "Choose the plan that fits your size"],
    ctaLabel: "Open Camp Creator Pro",
    ctaPath: "/dashboard",
    footer: "The founding customer offer is still available for a limited time.",
  },
];

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] || char));
}

function firstName(name: string | null, email: string) {
  const raw = (name || email.split("@")[0] || "there").trim();
  return raw.split(/\s+/)[0] || "there";
}

export function daysSince(date: Date, now = new Date()) {
  const ms = now.getTime() - date.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function getDueTrialEmailStep(user: Pick<TrialEmailUser, "createdAt">, sentSteps: Set<string>, now = new Date()) {
  const ageDays = daysSince(user.createdAt, now);
  const due = TRIAL_EMAIL_SEQUENCE
    .filter(email => email.day <= ageDays && !sentSteps.has(email.step))
    .sort((a, b) => b.day - a.day)[0];
  return due || null;
}

function appUrl(path: string) {
  const base = getBaseUrl().replace(/\/$/, "");
  if (path.startsWith("http")) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function renderTrialEmail(definition: TrialEmailDefinition, user: TrialEmailUser) {
  const greetingName = firstName(user.name, user.email);
  const ctaUrl = appUrl(definition.ctaPath);
  const bulletHtml = definition.bullets.map(item => `<li style="margin:8px 0;color:#475569;">${escapeHtml(item)}</li>`).join("");
  const plainBullets = definition.bullets.map(item => `- ${item}`).join("\n");

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(definition.preview)}</div>
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:linear-gradient(135deg,#4f46e5,#0ea5e9);border-radius:24px;padding:30px;color:#fff;text-align:center;">
      <div style="font-size:42px;margin-bottom:8px;">Camp Creator Pro</div>
      <h1 style="margin:0;font-size:28px;line-height:1.15;font-weight:900;">${escapeHtml(definition.heading)}</h1>
      <p style="margin:14px 0 0;color:rgba(255,255,255,.88);font-size:15px;">14-day trial · no credit card required · 50% off first year</p>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:20px;margin-top:18px;padding:28px;box-shadow:0 18px 45px rgba(15,23,42,.08);">
      <p style="margin:0 0 16px;font-size:16px;color:#334155;">Hi ${escapeHtml(greetingName)},</p>
      <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#475569;">${escapeHtml(definition.intro)}</p>
      <ul style="margin:0 0 24px;padding-left:22px;">${bulletHtml}</ul>
      <a href="${ctaUrl}" style="display:block;background:#0f172a;color:#fff;text-align:center;padding:15px 18px;border-radius:14px;font-weight:900;text-decoration:none;font-size:15px;">${escapeHtml(definition.ctaLabel)}</a>
      ${definition.footer ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.55;color:#64748b;">${escapeHtml(definition.footer)}</p>` : ""}
    </div>
    <p style="text-align:center;margin:18px 0 0;font-size:12px;color:#94a3b8;">Camp Creator Pro — built for camp directors, volunteers, and spreadsheet survivors.</p>
  </div>
</body></html>`;

  const text = `Hi ${greetingName},\n\n${definition.heading}\n\n${definition.intro}\n\n${plainBullets}\n\n${definition.ctaLabel}: ${ctaUrl}\n\n${definition.footer || ""}\n\nCamp Creator Pro`;
  return { html, text };
}

export async function sendTrialEmail(user: TrialEmailUser, step: TrialEmailStep) {
  const definition = TRIAL_EMAIL_SEQUENCE.find(email => email.step === step);
  if (!definition) throw new Error(`Unknown trial email step: ${step}`);
  if (!process.env.RESEND_API_KEY) return { sent: false, skipped: "RESEND_API_KEY missing" };

  const { html, text } = renderTrialEmail(definition, user);
  const resend = getResend();
  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: user.email,
    subject: definition.subject,
    html,
    text,
  });

  if (result.error) throw new Error(result.error.message);

  await prisma.trialEmailLog.upsert({
    where: { userId_step: { userId: user.id, step } },
    update: { sentAt: new Date(), subject: definition.subject, providerId: result.data?.id || null },
    create: { userId: user.id, email: user.email, step, subject: definition.subject, providerId: result.data?.id || null },
  });

  return { sent: true, providerId: result.data?.id || null };
}

export async function sendWelcomeTrialEmail(user: TrialEmailUser) {
  try {
    const existing = await prisma.trialEmailLog.findUnique({ where: { userId_step: { userId: user.id, step: "welcome" } } });
    if (existing) return { sent: false, skipped: "already_sent" };
    return await sendTrialEmail(user, "welcome");
  } catch (error) {
    console.error("Welcome trial email failed:", error instanceof Error ? error.message : String(error));
    return { sent: false, error: error instanceof Error ? error.message : "unknown" };
  }
}
