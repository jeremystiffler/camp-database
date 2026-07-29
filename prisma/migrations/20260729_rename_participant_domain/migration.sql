-- Terminology-only migration: preserve every row and relationship while
-- renaming the participant domain across the physical database.

ALTER TABLE "Camp" RENAME COLUMN "camperPriceCents" TO "participantPriceCents";
UPDATE "Camp" SET "billingMode" = 'participantFee' WHERE "billingMode" = 'camperFee';

ALTER TABLE "Camper" RENAME TO "Participant";
ALTER TABLE "Participant" RENAME CONSTRAINT "Camper_pkey" TO "Participant_pkey";
ALTER TABLE "Participant" RENAME CONSTRAINT "Camper_campId_fkey" TO "Participant_campId_fkey";
ALTER TABLE "Participant" RENAME CONSTRAINT "Camper_ageGroupId_fkey" TO "Participant_ageGroupId_fkey";
ALTER TABLE "Participant" RENAME CONSTRAINT "camper_preferences_max_three" TO "participant_preferences_max_three";
ALTER INDEX "Camper_scanCode_key" RENAME TO "Participant_scanCode_key";
ALTER INDEX "Camper_campId_pickupNumber_idx" RENAME TO "Participant_campId_pickupNumber_idx";

ALTER TABLE "Enrollment" RENAME COLUMN "camperId" TO "participantId";
ALTER TABLE "Enrollment" RENAME CONSTRAINT "Enrollment_camperId_fkey" TO "Enrollment_participantId_fkey";
ALTER INDEX "Enrollment_camperId_sessionId_key" RENAME TO "Enrollment_participantId_sessionId_key";

ALTER TABLE "CamperAttendance" RENAME TO "ParticipantAttendance";
ALTER TABLE "ParticipantAttendance" RENAME COLUMN "camperId" TO "participantId";
ALTER TABLE "ParticipantAttendance" RENAME CONSTRAINT "CamperAttendance_pkey" TO "ParticipantAttendance_pkey";
ALTER TABLE "ParticipantAttendance" RENAME CONSTRAINT "CamperAttendance_campId_fkey" TO "ParticipantAttendance_campId_fkey";
ALTER TABLE "ParticipantAttendance" RENAME CONSTRAINT "CamperAttendance_camperId_fkey" TO "ParticipantAttendance_participantId_fkey";
ALTER INDEX "CamperAttendance_campId_camperId_campDate_key" RENAME TO "ParticipantAttendance_campId_participantId_campDate_key";
ALTER INDEX "CamperAttendance_campId_campDate_status_idx" RENAME TO "ParticipantAttendance_campId_campDate_status_idx";

ALTER TABLE "CheckInEvent" RENAME COLUMN "camperId" TO "participantId";
ALTER TABLE "CheckInEvent" RENAME CONSTRAINT "CheckInEvent_camperId_fkey" TO "CheckInEvent_participantId_fkey";
ALTER INDEX "CheckInEvent_campId_camperId_createdAt_idx" RENAME TO "CheckInEvent_campId_participantId_createdAt_idx";

ALTER TABLE "RegistrationPayment" RENAME COLUMN "camperId" TO "participantId";
UPDATE "RegistrationPayment" SET "type" = 'participant_registration' WHERE "type" = 'camper_registration';

ALTER TABLE "RegistrationPaymentCamper" RENAME TO "RegistrationPaymentParticipant";
ALTER TABLE "RegistrationPaymentParticipant" RENAME COLUMN "camperId" TO "participantId";
ALTER TABLE "RegistrationPaymentParticipant" RENAME CONSTRAINT "RegistrationPaymentCamper_pkey" TO "RegistrationPaymentParticipant_pkey";
ALTER TABLE "RegistrationPaymentParticipant" RENAME CONSTRAINT "RegistrationPaymentCamper_paymentId_fkey" TO "RegistrationPaymentParticipant_paymentId_fkey";
ALTER TABLE "RegistrationPaymentParticipant" RENAME CONSTRAINT "RegistrationPaymentCamper_camperId_fkey" TO "RegistrationPaymentParticipant_participantId_fkey";
ALTER INDEX "RegistrationPaymentCamper_camperId_idx" RENAME TO "RegistrationPaymentParticipant_participantId_idx";
