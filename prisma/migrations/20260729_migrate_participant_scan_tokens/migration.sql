-- Keep the secure random token suffix unchanged so previously printed QR codes
-- remain recognizable by the suffix-compatible scanner while stored values adopt
-- the participant namespace.
UPDATE "Participant"
   SET "scanCode" = 'ssp:participant:' || substring("scanCode" from '[^:]+$'),
       "scanCodeGeneratedAt" = COALESCE("scanCodeGeneratedAt", NOW())
 WHERE "scanCode" LIKE 'campdb:camper:%';
