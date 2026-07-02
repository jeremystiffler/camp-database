# Camp Database Pickup / QR System — Project Report

## Version 1 — Schema + API Foundations

**Status:** Complete

### Delivered
- Added camper identity fields:
  - `pickupNumber`
  - `scanCode`
  - `scanCodeGeneratedAt`
  - `pickupCardPrintedAt`
  - `badgePrintedAt`
- Added unique index for `scanCode` and camp-scoped index for `pickupNumber` lookup.
- Added secure scan-code generation using non-PII UUID-based tokens.
- Added server-side pickup-number normalization.
- New campers created from admin or public registration now receive a secure scan code automatically.
- Added authenticated editor+ identity API for:
  - Ensuring missing camper identity records
  - Bulk assigning missing pickup numbers
  - Updating pickup numbers
  - Regenerating camper scan codes
  - Marking cards/badges printed

### Verification
- TypeScript check passed with `node node_modules/typescript/lib/tsc.js --noEmit`.
- Production build passed with `npm run build`.
- Production Neon schema migration verified the five new camper columns exist.

## Version 2 — Camper + Check-In UI Access

**Status:** Complete

### Delivered
- Added reusable `CamperScannableCode` QR component.
- Check-In scanner/search now accepts:
  - Secure scan code / QR contents
  - Pickup number
  - Camper name
  - Guardian name/email/phone
  - Emergency phone
- Check-In rows now show pickup number.
- Check-In rows include a `QR / Pickup` action that opens a modal with:
  - Camper QR code
  - Pickup number
  - Family pickup card label
  - Copy scan-code action
  - Print Center link
- Campers page now includes pickup/search support.
- Camper drawer now includes a `Pickup / Scannable Codes` section with:
  - Pickup number editing
  - QR display
  - Ensure-code action
  - Regenerate-QR action
  - Copy scan-code action
- Campers page includes `Assign Pickup #s` bulk action for missing pickup numbers/codes.

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
  - QR code containing only the secure camper scan token
- Pickup roster prints a backup lookup table sorted by pickup number with:
  - Pickup number
  - Family/camper name
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
- Kiosk check-in behavior remains locked down; this implementation did not expose camper lists or private camper details in kiosk mode.

## Deployment Verification

_To be completed after production deploy._
