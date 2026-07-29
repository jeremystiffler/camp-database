import { prisma } from "@/lib/db";
import { FROM_EMAIL, getResend } from "@/lib/email";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

async function sendPaidConfirmation(paymentId: string) {
  const payment = await prisma.registrationPayment.findUnique({
    where: { id: paymentId },
    include: { camp: { select: { name: true } }, participants: { include: { participant: { select: { firstName: true, lastName: true } } } } },
  });
  if (!payment?.guardianEmail) return;
  const participantNames = payment.participants.map(link => `${link.participant.firstName} ${link.participant.lastName}`);
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: payment.currency.toUpperCase() }).format(payment.amountCents / 100);
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: payment.guardianEmail,
    subject: `Payment confirmed — ${payment.camp.name}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px"><h1 style="font-size:24px">Registration confirmed</h1><p>Stripe confirmed your ${escapeHtml(amount)} payment for <strong>${escapeHtml(payment.camp.name)}</strong>.</p><p><strong>Participants:</strong> ${participantNames.map(escapeHtml).join(", ")}</p><p>Your event organizer can help with registration or refund questions.</p></div>`,
  });
}

export async function completePendingRegistrationPayment(input: {
  paymentId: string;
  stripeAccountId: string;
  checkoutSessionId: string;
  paymentIntentId?: string;
}) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `WITH transitioned AS (
       UPDATE "RegistrationPayment"
          SET "status" = 'paid',
              "stripePaymentIntent" = COALESCE($4, "stripePaymentIntent"),
              "paidAt" = NOW(),
              "couponRedeemedAt" = CASE WHEN "couponReservedAt" IS NOT NULL THEN NOW() ELSE "couponRedeemedAt" END,
              "updatedAt" = NOW()
        WHERE "id" = $1
          AND "status" = 'pending'
          AND "stripeConnectAccountId" = $2
          AND "stripeCheckoutSession" = $3
        RETURNING "id"
     ), updated_participants AS (
       UPDATE "Participant" AS c
          SET "paymentStatus" = 'paid',
              "totalPaidCents" = rpc."allocatedAmountCents"
         FROM "RegistrationPaymentParticipant" AS rpc, transitioned
        WHERE rpc."paymentId" = transitioned."id"
          AND c."id" = rpc."participantId"
        RETURNING c."id"
     )
     SELECT "id" FROM transitioned`,
    input.paymentId,
    input.stripeAccountId,
    input.checkoutSessionId,
    input.paymentIntentId || null,
  );
  if (rows.length > 0) await sendPaidConfirmation(input.paymentId).catch(error => console.error("Paid registration confirmation email failed", error));
  return rows.length > 0;
}

export async function failPendingRegistrationPayment(input: {
  paymentId: string;
  stripeAccountId: string;
  code: string;
  message?: string;
}) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `WITH transitioned AS (
       UPDATE "RegistrationPayment"
          SET "status" = 'failed',
              "failedAt" = NOW(),
              "failureCode" = $3,
              "failureMessage" = $4,
              "updatedAt" = NOW()
        WHERE "id" = $1
          AND "status" = 'pending'
          AND "stripeConnectAccountId" = $2
        RETURNING "id", "campId", "couponCode", "couponReservedAt", "couponRedeemedAt"
     ), released_coupon AS (
       UPDATE "CampCoupon" AS coupon
          SET "redeemedCount" = GREATEST(coupon."redeemedCount" - 1, 0),
              "updatedAt" = NOW()
         FROM transitioned
        WHERE coupon."campId" = transitioned."campId"
          AND coupon."code" = transitioned."couponCode"
          AND transitioned."couponReservedAt" IS NOT NULL
          AND transitioned."couponRedeemedAt" IS NULL
        RETURNING coupon."id"
     ), linked_participants AS (
       SELECT rpc."participantId", transitioned."campId"
         FROM "RegistrationPaymentParticipant" AS rpc
         JOIN transitioned ON transitioned."id" = rpc."paymentId"
     ), deleted_enrollments AS (
       DELETE FROM "Enrollment" AS enrollment
        USING linked_participants
        WHERE enrollment."participantId" = linked_participants."participantId"
          AND enrollment."campId" = linked_participants."campId"
        RETURNING enrollment."sessionId"
     ), released_seats AS (
       UPDATE "Session" AS session
          SET "enrolledCount" = GREATEST(session."enrolledCount" - counts.n, 0)
         FROM (SELECT "sessionId", COUNT(*)::int AS n FROM deleted_enrollments GROUP BY "sessionId") AS counts
        WHERE session."id" = counts."sessionId"
        RETURNING session."id"
     ), deleted_participants AS (
       DELETE FROM "Participant" AS participant
        USING linked_participants
        WHERE participant."id" = linked_participants."participantId"
          AND participant."paymentStatus" = 'pending'
        RETURNING participant."id"
     )
     SELECT "id" FROM transitioned`,
    input.paymentId,
    input.stripeAccountId,
    input.code,
    input.message || null,
  );
  return rows.length > 0;
}
