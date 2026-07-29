-- Rebuild renamed indexes so PostgreSQL's internal index tuple attribute labels
-- also reflect participantId rather than retaining labels from the pre-rename columns.

DROP INDEX "Enrollment_participantId_sessionId_key";
CREATE UNIQUE INDEX "Enrollment_participantId_sessionId_key" ON "Enrollment"("participantId", "sessionId");

DROP INDEX "ParticipantAttendance_campId_participantId_campDate_key";
CREATE UNIQUE INDEX "ParticipantAttendance_campId_participantId_campDate_key" ON "ParticipantAttendance"("campId", "participantId", "campDate");

DROP INDEX "CheckInEvent_campId_participantId_createdAt_idx";
CREATE INDEX "CheckInEvent_campId_participantId_createdAt_idx" ON "CheckInEvent"("campId", "participantId", "createdAt");

DROP INDEX "RegistrationPaymentParticipant_participantId_idx";
CREATE INDEX "RegistrationPaymentParticipant_participantId_idx" ON "RegistrationPaymentParticipant"("participantId");

ALTER TABLE "RegistrationPaymentParticipant" DROP CONSTRAINT "RegistrationPaymentParticipant_pkey";
ALTER TABLE "RegistrationPaymentParticipant" ADD CONSTRAINT "RegistrationPaymentParticipant_pkey" PRIMARY KEY ("paymentId", "participantId");
