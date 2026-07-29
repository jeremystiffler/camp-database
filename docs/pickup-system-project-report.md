# Camp Database Pickup / QR System — Project Report

## Version 1 — Schema + API Foundations

**Status:** Complete

### Delivered
- Added participant identity fields:
  - `pickupNumber`
  - `scanCode`
  - `scanCodeGeneratedAt`
  - `pickupCardPrintedAt`
  - `badgePrintedAt`
- Added unique index for `scanCode` and camp-scoped index for `pickupNumber` lookup.
- Added secure scan-code generation using non-PII UUID-based tokens.
- Added server-side pickup-number normalization.
- New participants created from admin or public registration now receive a secure scan code automatically.
- Added authenticated editor+ identity API for:
  - Ensuring missing participant identity records
  - Bulk assigning missing pickup numbers
  - Updating pickup numbers
  - Regenerating participant scan codes
  - Marking cards/badges printed

### Verification
- TypeScript check passed with `node node_modules/typescript/lib/tsc.js --noEmit`.
- Production build passed with `npm run build`.
- Production Neon schema migration verified the five new participant columns exist.

## Version 2 — Participant + Check-In UI Access

**Status:** Complete

### Delivered
- Added reusable `ParticipantScannableCode` QR component.
- Check-In scanner/search now accepts:
  - Secure scan code / QR contents
  - Pickup number
  - Participant name
  - Guardian name/email/phone
  - Emergency phone
- Check-In rows now show pickup number.
- Check-In rows include a `QR / Pickup` action that opens a modal with:
  - Participant QR code
  - Pickup number
  - Family pickup card label
  - Copy scan-code action
  - Print Center link
- Participants page now includes pickup/search support.
- Participant drawer now includes a `Pickup / Scannable Codes` section with:
  - Pickup number editing
  - QR display
  - Ensure-code action
  - Regenerate-QR action
  - Copy scan-code action
- Participants page includes `Assign Pickup #s` bulk action for missing pickup numbers/codes.

### Verification
- TypeScript check passed.
- Production build passed.

## Version 3 — Print Center Pickup Materials

**Status:** Complete

### Delivered
- Added Print Center stock preset: `Pickup Window Cards — Number + Family`.
- Added Print Center stock preset: `Pickup Number Roster`.
- Pickup window cards print as 4×6 landscape cards with:
  - Large pickup number
  - Family last name
  - QR code containing only the secure participant scan token
- Pickup roster prints a backup lookup table sorted by pickup number with:
  - Pickup number
  - Family/participant name
  - Guardian
  - Phone
  - Age group
- Print Center custom document-type selector now supports pickup cards and pickup rosters.

### Verification
- TypeScript check passed.
- Production build passed.

## Privacy / Safety Notes

- QR codes contain only the secure scan token, not names, phone numbers, medical notes, guardian data, or other PII.
- Pickup cards default to pickup number + family last name.
- Kiosk check-in behavior remains locked down; this implementation did not expose participant lists or private participant details in kiosk mode.

## Deployment Verification

**Status:** Complete

- Local TypeScript check passed: `node node_modules/typescript/lib/tsc.js --noEmit`.
- Local production build passed: `npm run build`.
- Production Neon schema verified columns and indexes:
  - Columns: `pickupNumber`, `scanCode`, `scanCodeGeneratedAt`, `pickupCardPrintedAt`, `badgePrintedAt`
  - Indexes: `Participant_scanCode_key`, `Participant_campId_pickupNumber_idx`
- Vercel production deploy succeeded and aliased to `https://camp-database.vercel.app`.
- Live protected identity API route verified present and permissioned: `POST /api/camps/test/participants/identity` returned `401 Unauthorized` with matched route `/api/camps/[campId]/participants/identity`.
- Live app routes checked after deployment: `/print` and `/check-in` responded from production.
