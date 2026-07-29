-- Phase 4: store the event's colour scheme by name, not by hex.
--
-- The six presets each carry five pre-measured tiers (wash / ink / rail /
-- strong / accent), so contrast is guaranteed rather than inferred. Before
-- this, the preset was re-derived from primaryColor on every render by
-- pattern-matching a hex string against a lookup table.
--
-- primaryColor and accentColor are NOT dropped: public registration, print
-- material and the registration-form API still read them. They become the
-- rendered output of the preset rather than the source of truth.

ALTER TABLE "Camp" ADD COLUMN IF NOT EXISTS "themePreset" TEXT NOT NULL DEFAULT 'ember';

-- Backfill from what each event already has. Exact preset matches first, then
-- the legacy hue families, then the two colours that were in no table at all
-- (#4F46E5 indigo from the signup route, #A1624A brown) mapped to their nearest
-- preset rather than being silently turned Harbor blue by the default.
UPDATE "Camp" SET "themePreset" = CASE
  WHEN UPPER("primaryColor") = '#2F6FB8' THEN 'harbor'
  WHEN UPPER("primaryColor") = '#2E7D63' THEN 'evergreen'
  WHEN UPPER("primaryColor") = '#6B4E9E' THEN 'plum'
  WHEN UPPER("primaryColor") = '#A85832' THEN 'ember'
  WHEN UPPER("primaryColor") = '#A34862' THEN 'rose'
  WHEN UPPER("primaryColor") = '#4A6580' THEN 'slate'
  -- Legacy hue families (§4.7 migration table).
  WHEN UPPER("primaryColor") IN ('#075985', '#1E3A8A', '#1E40AF', '#2563EB', '#155E75') THEN 'harbor'
  WHEN UPPER("primaryColor") IN ('#166534', '#0F766E') THEN 'evergreen'
  WHEN UPPER("primaryColor") IN ('#5B21B6', '#701A75', '#9D174D') THEN 'plum'
  WHEN UPPER("primaryColor") IN ('#C2410C', '#A16207', '#9A3412', '#F0894A') THEN 'ember'
  WHEN UPPER("primaryColor") IN ('#BE123C', '#991B1B') THEN 'rose'
  WHEN UPPER("primaryColor") IN ('#334155', '#1F2937') THEN 'slate'
  -- Unmapped, resolved by nearest hue.
  WHEN UPPER("primaryColor") = '#4F46E5' THEN 'harbor'
  WHEN UPPER("primaryColor") = '#A1624A' THEN 'ember'
  ELSE 'ember'
END;

-- Keep the rendered hex in step with the preset it now names, so the public
-- registration page and print material stop showing colours that no longer
-- correspond to any preset.
UPDATE "Camp" SET
  "primaryColor" = CASE "themePreset"
    WHEN 'harbor'    THEN '#2F6FB8'
    WHEN 'evergreen' THEN '#2E7D63'
    WHEN 'plum'      THEN '#6B4E9E'
    WHEN 'ember'     THEN '#A85832'
    WHEN 'rose'      THEN '#A34862'
    WHEN 'slate'     THEN '#4A6580'
    ELSE "primaryColor" END,
  "accentColor" = CASE "themePreset"
    WHEN 'harbor'    THEN '#7FB6D4'
    WHEN 'evergreen' THEN '#8CC0AB'
    WHEN 'plum'      THEN '#B3A0D8'
    WHEN 'ember'     THEN '#E0A87C'
    WHEN 'rose'      THEN '#D99BAF'
    WHEN 'slate'     THEN '#A3B8CB'
    ELSE "accentColor" END;

-- A preset outside the six would defeat the guarantee entirely.
ALTER TABLE "Camp" DROP CONSTRAINT IF EXISTS "camp_theme_preset_known";
ALTER TABLE "Camp" ADD CONSTRAINT "camp_theme_preset_known"
  CHECK ("themePreset" IN ('harbor', 'evergreen', 'plum', 'ember', 'rose', 'slate'));
