# Camp Database full-site diagnostic — 2026-07-04

Backup before this work:

- Branch: `backup/pre-diagnostic-20260704-200954-d9712d5`
- Tag: `backup/pre-diagnostic-20260704-200954-d9712d5`
- Commit: `d9712d5`

## Snapshot

- Source files scanned: 82
- Source lines scanned: 18,721
- Largest files:
  - `src/app/(protected)/setup/page.tsx` — 1,417 lines
  - `src/app/(protected)/activities/page.tsx` — 1,293 lines
  - `src/app/(protected)/print/page.tsx` — 1,004 lines
  - `src/app/(protected)/campers/page.tsx` — 924 lines
  - `src/app/(protected)/registration/page.tsx` — 885 lines
  - `src/app/(protected)/check-in/page.tsx` — 810 lines
  - `src/components/TimeslotAssignmentGrid.tsx` — 711 lines

## Key findings

### 1. Page components are carrying too many jobs

Most protected routes combine data loading, types, transformations, modals, helpers, and large JSX blocks in one file. This is why safe changes are slower and harder to verify.

Priority targets:

- `setup/page.tsx`
- `activities/page.tsx`
- `print/page.tsx`
- `campers/page.tsx`
- `registration/page.tsx`
- `check-in/page.tsx`

Risk: CAREFUL. Split by extracting components/hooks, not changing behavior.

### 2. Explanatory text is mixed into core UI

The app has hundreds of long instructional strings. The most text-heavy files are:

- `activities/page.tsx` — ~5,007 words in long UI text/literals
- `print/page.tsx` — ~5,599 words
- `setup/page.tsx` — ~5,485 words
- `registration/page.tsx` — ~4,078 words
- `TimeslotAssignmentGrid.tsx` — ~3,521 words

Recommendation: default UI should show short labels/actions. Move explanation into Help Mode popups/tooltips.

Risk: SAFE/CAREFUL if copy-only and no validation logic changes.

### 3. Repeated UI primitives should be centralized

Repeated class patterns indicate homegrown cards/buttons/section labels are duplicated:

- `rounded-2xl border border-slate-200`
- `text-xs font-black uppercase tracking...`
- `shadow-sm`
- `rounded-3xl border border-slate-200 bg-white`

Recommendation: introduce shared `Panel`, `SectionLabel`, `HelpCopy`, `ActionButton` primitives gradually.

Risk: CAREFUL. Visual-only but broad CSS/class refactors can accidentally change layouts.

### 4. Fetch/data loading is repeated per page

There are 134 `fetch` calls in TSX, with the heaviest concentration in:

- `setup/page.tsx` — 28
- `activities/page.tsx` — 14
- `TimeslotAssignmentGrid.tsx` — 12
- `print/page.tsx` — 11
- `settings/page.tsx` — 10
- `import/page.tsx` — 10

Recommendation: introduce small typed API helpers per feature area, not a giant abstraction. Start with `jsonFetch` and page-specific hooks.

Risk: CAREFUL/RISKY depending on mutations. Avoid altering server-side permission checks.

### 5. Performance risks are mostly client-side weight and rerender churn

Observed signals:

- 208 `useState` calls across TSX, with several pages over 15 each.
- Large arrays are filtered/sorted inline in render paths.
- Print page has large template/config data and rendering logic in one client bundle.

Recommendation:

- Extract pure helpers from render components.
- Memoize expensive derived lists where they depend on stable inputs.
- Lazy-load heavy modals/print preview later only if bundle analysis confirms benefit.

Risk: CAREFUL. Measure with build/typecheck after each step.

## First safe implementation step completed

Introduced a global Help Mode foundation:

- `src/components/HelpMode.tsx`
  - `HelpModeProvider`
  - `HelpModeToggle`
  - `HelpTip`
  - `HelpCopy`
- Wrapped root app in `HelpModeProvider`.
- Added Help Mode toggle to protected sidebar footer.
- Converted dashboard quick-action descriptions to help-aware copy.

Next recommended steps:

1. Convert page headers and section descriptions to `HelpCopy` in all protected pages.
2. Extract repeated shell/card primitives.
3. Split the six largest page components one at a time.
4. Only after extraction, optimize repeated fetch/data helpers.

## Guardrails

- Do not remove features.
- Do not change database schema during simplification unless a specific feature requires it.
- Keep server-side validation and permissions intact.
- Verify with TypeScript and full Next production build after each phase.
