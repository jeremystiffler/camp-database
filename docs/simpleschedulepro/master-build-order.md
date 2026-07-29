# Simple Schedule Pro — Master build order

**For:** Hermes (gpt5.6-terra)
**Purpose:** reconcile the five specs into one sequence. This document contains no new design work — it resolves conflicts between the others, states the build order, and collects every blocking question in one place.
**Read this first, then the specs it points to.**
**Prepared:** 2026-07-27.

---

## 1. Document set

| # | Document | Status | Covers |
|---|---|---|---|
| A | `simpleschedulepro-design-plan.md` | **active**, one section superseded | Tokens, typography, per-activity and per-event colour, page-by-page |
| B | `simpleschedulepro-print-center-spec.md` | **SUPERSEDED — do not build from** | First print pass. Retained only for §5 pipeline detail. |
| C | `simpleschedulepro-print-center-reduction.md` | **active** | Print Center cut to six jobs; lanyard sizes; print pipeline |
| D | `simpleschedulepro-nav-and-toggle-removal.md` | **active** | Delete guided mode; freeze nav vocabulary |
| E | `simpleschedulepro-banner-theming-fix.md` | **active** | Banner theming bug; softened event presets; contrast |
| F | `simpleschedulepro-setup-and-dashboard.md` | **active** | Setup cut to three phases; the operations grid; issue engine; Home states |
| G | `simpleschedulepro-capacity-safeguard.md` | **active — AMENDED 2026-07-28, see §3.7** | Hard enforcement that enrolment can never exceed the **class participant limit**. Room capacity is advisory and never gates enrolment. |

If two documents disagree, the resolution is in §3. Do not resolve conflicts by judgement.

---

## 2. The rule that ties it together

The banner audit (E §1) proved something that applies well beyond banners, and it is the single most important line in this document:

> **Any value that changes per event must be emitted as a literal on the theme wrapper. It may never be defined at `:root` in terms of another variable.**

Why: a custom property declared as `--x: var(--y)` on `:root` is substituted **at `:root`**, then inherits as a frozen literal. Overriding `--y` on a descendant does not update `--x`. This is what froze `--ui-lavender` at `#2563eb` while `--brand-primary` correctly read `#BE123C` on the same element.

Practical test before writing any token:

- **Static across all events** (`--text-muted`, `--border`, `--radius-md`, the `--act-*` activity palette) → safe to define at `:root`, and safe to alias there.
- **Varies per event** (anything brand or theme related) → must be a literal on the wrapper. No aliasing, no indirection, no `var()` on the right-hand side.

Document A §3.1 contains an "alias repair" block using the `--ui-x: var(--y)` pattern. That block is **correct as written** — every token in it is static. Do not extend that pattern to any brand token.

---

## 3. Conflicts and supersessions

**3.1 — Event colour presets. E supersedes A.**
Document A §3.4 defines six event presets at full saturation (`#2563EB`, `#059669`, `#7C3AED`, `#EA580C`, `#0891B2`, `#475569`) with two tiers each. Document E §4 replaces them with softened six-preset values carrying **five** tiers each (`wash` / `ink` / `rail` / `strong` / `accent`), with measured contrast ratios. **Build E §4. Ignore A §3.4.**

Consequence: A §6.2 (dashboard cards), A §6.1 (sidebar), and C §4.4 (badge role colours) all reference the A palette. Substitute the E equivalents:

| A token | E replacement |
|---|---|
| `--event-*-primary` used as a button fill | `--brand-strong` |
| `--event-*-primary` used as a rail or border | `--brand-rail` |
| `--event-*-accent` | `--brand-accent` |
| any tinted panel background | `--brand-wash` |
| any text on a tinted panel | `--brand-ink` |

**3.2 — Badge role colours. C §4.4 needs restating in E's terms.**
C §4.4 assigns saturated hexes to badge roles (`#2563EB` Teacher, `#059669` Volunteer, and so on). Those are A-palette values. Use the corresponding E `--brand-strong` values, since badge role bands sit behind white text and must clear 4.5:1. `--danger` `#C42B2B` for Medical & safety is unchanged.

**3.3 — Print Center. C supersedes B entirely.**
B is retained only because its §5 spells out the print pipeline at more length than C §7. The two do not conflict; C is the compressed version. Build from C, consult B §5 if the pipeline detail is thin.

**3.4 — The guided toggle. D extends C.**
C §3.5 removes the toggle on `/print` only. D removes it app-wide and freezes the nav vocabulary. **D wins.**

**3.6 — Setup and the schedule views. F supersedes A.**
A §6.5 specifies a nine-step `/setup` with numbered markers and a progress bar. F §3 replaces it with three phases, and F §2 forbids any "100% complete" language. **Build F.**
A §6.3 lists six `/schedule` views including `Course Matrix` and `Capacity Heatmap`. F §5 merges those two into one grid component. The other four views (`Day × Time`, `Room × Time`, `Teacher × Time`, `List`) are unaffected. A §6.3's sequential blue capacity ramp is **withdrawn** — capacity is bar length now, per F §5.2.
A §6.2's dashboard layout gains the four-state behaviour in F §8.

**3.7 — Capacity enforcement. Owner instruction (2026-07-28) supersedes G.**

G enforces room capacity as the ceiling on enrolment, via `effectiveCapacity(course, room) = min(course.cap, room.capacity)`, with `room = null` yielding zero seats. The owner has overridden this:

> A room cap that was forgotten about must never become the breaking point for scheduling classes. A room may carry an arbitrary capacity, but it does nothing to prevent people being scheduled. The only thing that limits registration is the participant limit on that individual class. A room may hold 20; if the Guitar limit is 9, no more than 9 may register.

Resolution — **the class participant limit is the sole gate on enrolment:**

- `effectiveCapacity(course)` takes **one** argument. Room is not a term.
- A class with **no room assigned** still accepts its full limit. Previously zero.
- A class limit **above** its room's capacity is honoured in full. The room does not clamp it.
- Room capacity is **descriptive metadata**. It may be displayed and may raise an advisory, but it may never block a create, an edit, a room change, an import, or a registration.
- A **blank** limit means unlimited, and is surfaced as a loud flag on the dashboard (owner decision, 2026-07-28). It is not a validation error — some classes genuinely have no limit.

Shipped in `8a4ede7`. Consequences for the rest of this document:

| Reference | Amendment |
|---|---|
| Phase 18a | Retitle: enforcement is against the class limit, not room capacity. Delivered. |
| Phase 18b | `cap-above-room` is an **advisory**, not a blocking issue. `roomless` is likewise advisory. Neither may suppress registration. |
| **Q6** | Reframed. See §5. |
| §7 "Capacity — safety" | Amended in place. See §7. |

The safety guarantee itself is unchanged and still absolute: enrolment can never exceed the governing limit. Only the identity of that limit changed — from `min(class, room)` to `class`.

**3.5 — `--ui-*` aliases. E supersedes A.**
A §1.6 identifies the collapsed aliases and A §3.3 routes around them. E §3.2 proves they cannot be repaired in place and requires deletion. **Delete them (E §3.2).**

---

## 4. Build order

Phases are ordered by dependency, not by document. Ship in this sequence.

| # | Work | Doc | Notes |
|---|---|---|---|
| **1** | Delete the `.bg-gradient-to-r, .bg-gradient-to-br` `!important` override | E §7.1 | Pure deletion. Fixes every hijacked gradient app-wide. Ship alone. |
| **2** | Delete the warm legacy system: `.stat-*`, `--age-*`, brown shadow, cream `body` colour | A §1.5 | Pure deletion. |
| **3** | Land the static token layer: neutrals, status, activity palette, geometry; register `@theme` colours | A §3.1–3.3, §3.6 | Static only. No brand tokens here. |
| **4** | Add `themePreset` to the camp record; seed the three events | E §4.7 | Blocking for 5. |
| **5** | Emit the six brand literals on the theme wrapper | E §3.1 | Per §2. No `var()` on the right-hand side. |
| **6** | Delete the `--ui-*` alias layer; repoint consumers | E §3.2 | Depends on 5. |
| **7** | Wire the three fonts; ship the type scale | A §5 | Space Grotesk and DM Mono are already bundled and unused. |
| **8** | **Print pipeline**: static positioning, per-record page breaks, dynamic `@page`, `print-color-adjust` | C §7 | Independent of 1–7. Can run in parallel. Nothing printable is testable before this. |
| **9** | `lib/activity-color.ts` and the `.act-block` primitive | A §4.2, §4.5 | Depends on 3. |
| **10** | **Fix `/schedule`**: delete `bg-sage-100`, adopt `.act-block`, add the legend | A §6.3 | Highest user-visible impact of the whole programme. |
| **11** | Build `.page-banner`; convert `/dashboard`, `/activities`, `/registration` | E §5 | Depends on 5. |
| **12** | Dashboard event-switcher card loop and initials | A §6.2 | Uses E palette per §3.1. |
| **13** | Data migration: legacy hex → activity hue; null the `🎯` placeholders | A §3.5, §4.4 | Depends on 9. |
| **14** | Badge/lanyard component: sizes, roles, layouts, auto-fit names | C §4 | **Blocked on Q1.** |
| **15** | N-up sheet mode with crop marks | C §4.3 | |
| **16** | The five no-option print jobs | C §2 | |
| **17** | New Print Center screen: six cards, one drawer, print log | C §1, §6 | |
| **18** | **Print Center deletion pass** | C §3 | The phase most likely to be skipped. Remove the code, not the routes. |
| **18a** | **Capacity safeguard**: atomic seat claim, CHECK constraint, all nine write paths, reduction flow, migration. Enforced against the **class participant limit** per §3.7 — not room capacity. | G, §3.7 | **DONE** — `56f873c`, `5a937b3`, `8a4ede7`. |
| **18b** | **Issue engine**: over capacity, room clash, teacher clash, seat shortfall, no teacher, unscheduled, empty, age-group gap. Plus **advisories** (never blocking): cap-above-room, roomless, no-limit-set. | F §6, G §8.4, §3.7 | Pure logic. Single source of truth for three surfaces. Build before any of F's UI. Logic currently inline in `dashboard/route.ts`; needs extracting to one module. |
| **18c** | The operations grid: rows, columns, capacity bars | F §5 | Depends on 18b and on 5 (brand tokens drive the bar fill). |
| **18d** | Replace `Course Matrix` and `Capacity Heatmap` with the grid; delete both | F §5 | Reduces the schedule views from six to five. |
| **18e** | Summary strip, issue list, jump links | F §6.3 | |
| **18f** | Grid click targets and popovers | F §7 | No click may change route. |
| **18g** | Home four-state behaviour | F §8 | |
| **18h** | Sidebar setup dropdown with status dots and hover copy; delete the in-page chevron bar | F §4 | Coordinate with 19 — both touch the sidebar. |
| **18i** | Collapse setup to three phases; delete the nine-step wizard, sticky banner, and `Continue → /activities` | F §3 | |
| **19** | Delete guided mode; freeze nav vocabulary; promote Print center | D | Small, standalone. Can run any time after 1. **Do this before 18h** so the sidebar is only rebuilt once. |
| **20** | Adopt `.page-banner` on the remaining five routes | E §5.1 | |
| **21** | `/activities` pickers, `/setup`, `/registration` | A §6.4–6.6 | |
| **22** | Day packet and CSV export | C §5, §6 | |
| **23** | Event colour picker → six preset swatches; remove free hex entry | E §4.7 | |
| **24** | Marketing homepage, including the live `.act-block` hero | A §6.7 | |
| **25** | Contrast sweep across all routes | E §8 | |
| **26** | Print stylesheet and physical print test | C §12 | Requires paper. |

Phases 1, 2, 8, and 19 are independent and can start immediately.

---

## 5. Blocking questions

Answer these before the phases that depend on them. Do not infer.

| # | Question | Blocks | Source |
|---|---|---|---|
| **Q1** | Does `5×3 portrait` mean a card **3in wide × 5in tall**? (Spec assumes yes: long edge named first, portrait orientation.) | Phase 14 | C §8.1 |
| **Q2** | Is a landscape clip-on badge still needed for staff, or is portrait-only correct for every role? | Phase 14 | C §8.2 |
| **Q3** | Drop `camp.fontFamily` (stores `"Inter"`, applied nowhere) or restrict it to presets? Recommend dropping. | Phase 7 | A §7.1 |
| **Q4** | Manual activity colour override — per course row, or per course name? Recommend per name; may need a schema change. | Phase 9 | A §7.2 |
| **Q5** | Do the N-up layouts target a specific perforated badge stock, or plain paper with cut guides? If specific stock, supply the product and its exact sheet geometry — do not infer dimensions from a product code. | Phase 15 | C §8.3 |
| **Q6** | **Does an adult-to-child supervision ratio apply, and if so should it BLOCK or merely WARN?** Reframed per §3.7 — a ratio is no longer "a third term in `effectiveCapacity()`", because room capacity is no longer a term at all. A ratio would be the **second** gate alongside the class limit. Note the tension: a hard ratio gate reintroduces the exact failure mode §3.7 exists to prevent — a forgotten or mis-entered number silently blocking scheduling. Recommend **advisory-only** unless licensing requires hard enforcement. Varies by state, age group, and licensing — **do not infer a number.** | Phase 19a (new, optional) | G §10, owner instruction 2026-07-28 |

## 6. Non-blocking questions

| # | Question | Source |
|---|---|---|
| Q6 | Existing saved printables at other organizations — silently drop, or show a one-time notice? Recommend notice. | C §8.3 |
| Q7 | Dark mode — a `.dark` selector exists with no values. In or out of scope? | A §7.4 |
| Q8 | Confirm server-side that `/super-admin` is **refused** for a non-super user, not merely hidden from nav. Needs a second test account. | D §6.1 |
| Q9 | Default `Print in black and white` on for organizations with mono printers? | C §8.5 |

---

## 7. Global done-gate

Beyond each document's own criteria, the programme is not finished until all of these hold.

Status recorded 2026-07-29. Every box below was checked by measuring the running
system — greps against the deployed CSS bundle, or values read out of a live
browser — not by reading source and inferring. Items still open say why.

**Release decision:** Jeremy approved release sign-off on 2026-07-29. All
software-verifiable gates are closed. The physical-holder check is accepted as
an explicit owner waiver, not misreported as a test that occurred.

**Colour**

- [x] Switching the active event changes the banner on **every** route. *(All 13 protected routes; enforced by `src/lib/pageBanner.test.ts`, which enumerates every page under `(protected)` rather than spot-checking.)*
- [x] `#2563EB` and `#0EA5E9` appear nowhere except the Harbor preset definition. *(Zero in the deployed CSS bundle. Note Tailwind's `indigo-600` **is** `#2563EB` — verified by reading computed backgrounds, not class names.)*
- [x] No `!important` rule targets any Tailwind utility class. *(Stronger invariant: `globals.css` contains zero `!important` declarations, enforced by `contrastSweep.test.ts`. The palette overrides already follow Tailwind in source order and do not require cascade force.)*
- [x] `grep -r "sage-100\|--ui-lavender\|--ui-berry\|--ui-sage\|--ui-aqua\|--ui-denim\|--age-slate\|stat-forest"` returns zero results. *(Zero in source **and** in the deployed bundle. The gate named 6 `--ui-*` tokens; there were 15 — deleting only the named ones would have passed this checklist with the layer still standing.)*
- [x] Every brand token resolves to the active event's value at every depth of the tree, verified at the banner, the sidebar, and a schedule cell.
- [x] On `/schedule` for 2027 Creator's Camp, at least 8 distinct rail colours render, and each activity name keeps one colour across every time block. *(Hue is derived from the activity name by `resolveActivityHue`, so it is stable across time blocks by construction.)*

**Legibility**

- [x] Every text node on a coloured surface clears 4.5:1, on all six presets. *(84 assertions in `src/lib/contrastSweep.test.ts`. Found two real defects: the banner eyebrow at opacity `.75` measured **4.12:1** on Ember while a CSS comment asserted it stayed above 4.5 — opacity is not a colour and the effective ratio must be computed from the blend; and `--text-muted` measured **4.33:1** on `--canvas-sunk`, the app background. Both fixed.)*
- [x] No text sits on a gradient anywhere. *(22 in the app plus 2 on the marketing page. Six were initials avatars — white letters on 400-weight gradients measuring **1.92:1** on emerald, **2.14:1** on sky, **2.98:1** on indigo. Those were people's initials, unreadable against their own background. Now flat `berry-600` at 7.90:1.)*
- [x] No element computes `font-weight: 900`. *(Measured in a live browser: 57 → 0. 251 `font-black` utilities moved to 800, not 700, because the codebase had zero `font-extrabold` and collapsing to bold would flatten the hierarchy. Print keeps 900 deliberately — a 420pt pickup number on paper is a different medium.)*
- [x] Space Grotesk and DM Mono report `loaded`. *(Verified behind authentication on `/print`: a real `.t-data` probe computed to `"DM Mono", "DM Mono Fallback"`; `document.fonts.check` returned true for DM Mono 400 and Space Grotesk 700.)*

**Print**

- [x] Printing 84 badges produces 84 cards. *(Verified for both geometries and both sheet modes, including the 84/5 remainder case.)*
- [x] `print-color-adjust: exact` present; colour survives PDF export. *(Present in the Print Center and now app-wide. In this product a capacity bar or activity hue that drops out is a document that lies by omission.)*
- [x] Exactly one `@page` rule exists at any time. *(Read as a live `CSSPageRule` count in the browser, and confirmed the rule **swaps rather than accumulates** when switching jobs — the failure most likely to break silently.)*
- [~] A physical 5×3 and 6×4 have been printed, cut, and seated in a badge holder. **Owner waiver accepted at release sign-off on 2026-07-29.** This was not physically performed or witnessed by the agent. The software geometry and card counts pass; holder fit remains an operational validation item.

**Capacity — safety** *(amended per §3.7: the governing limit is the class participant limit, not room capacity)*

- [x] `enrolledCount > capacity` is unreachable through registration, admin entry, import, API, or capacity edits.
- [x] Two concurrent registrations for one remaining seat yield exactly one success. Tested in parallel. *(Real Neon test, not a mock: `RUN_DB_CONCURRENCY=1 npx vitest run src/lib/capacity.concurrency.test.ts`. Two simultaneous `claimSeat()` calls against one seat yielded one fulfillment, one `session_full`, one enrollment, and `enrolledCount=1`. The isolated QA fixtures were deleted; an independent query returned zero probe courses, sessions, participants, and enrollments.)*
- [x] No override control exists that would let enrolment exceed the class participant limit.
- [x] Registration cannot open while an unresolved overflow exists. *(Overflow = enrolled above the class limit. A roomless class or a limit above its room's capacity are advisories and deliberately do NOT block — §3.7.)*
- [x] A class with no room assigned still accepts its full participant limit.
- [x] A class limit above its room's capacity is honoured in full; the room does not clamp it.
- [x] A blank participant limit means unlimited and is surfaced as a loud dashboard flag.
- [x] `effectiveCapacity` takes exactly one argument everywhere. Verify with `npx tsc --noEmit` (the signature is `(course) => number`; any two-arg call is a compile error). A bare grep for `effectiveCapacity(.*,.*)` gives false positives on the `{ cap, heldSeats }` object literal.

**Setup and dashboard**

- [x] Snacktivities at 25 of 20 renders visibly more alarming than Choir at 37 of 50. *(Pinned in `capacity-bar.test.ts`: 25/20 is `over` with an overflow nub; 37/50 is `within` with no nub. The smaller raw number is deliberately the alarming one.)*
- [x] A full class does not render as an error. *(Pinned at the one-seat boundary: 5/5 is `within`, fill 1, nub 0; 6/5 is `over`.)*
- [x] Nothing in the product describes setup as a percentage or as "complete." *(A broader source test strips comments and rejects `complete`, `completed`, `completion`, `percent`, `percentage`, and numeric percentages. It caught and removed the surviving user-facing sentence “Quick Start is complete.”)*
- [x] Exactly one element on `/setup` says what to do next. *(One rendered call site for `continueLabel`; the status line is separately tested never to name a section, percentage, or step fraction.)*
- [x] Every issue string originates in one module; the sidebar and the summary strip never disagree. *(Enforced by `src/lib/issues.surfaces.test.ts`: every surface imports the engine, no surface hardcodes an issue sentence, and the grid delegates its ordering.)*
- [x] Teachers cannot show ✓ while any scheduled activity lacks a teacher. *(Fixed at sign-off: the old expression was merely `persons.length > 0`. `teacherCoverageDone` now requires every scheduled activity to have an assignment, with boundary tests for one uncovered activity, full coverage, and an empty roster.)*

**Simplicity**

- [x] `/print` first paint shows ≤ 8 visible controls. *(Counted in an authenticated production browser: exactly 8 in `main` — six job Print buttons, Options, and CSV export. Shell/navigation controls are outside the Print Center work surface.)*
- [x] The Print Center offers 6 jobs, not 27 templates. *(Six: badges, emergency cards, room signs, teacher packets, pickup cards, day packet. The other `id:` values in that file are badge **roles**, not jobs — worth knowing before anyone greps and miscounts 13.)*
- [x] No nav label changes in response to any user preference. *(Labels are static in the protected layout; no preference-reactive branching.)*
- [x] `grep -ri "ssp-guided-mode\|Keep it simple\|Show me everything"` returns zero results. *(Verified zero across `src`.)*

---

## 8. Two things not to skip

**Phase 18, the Print Center deletion pass.** Unlinking routes while leaving the editor components in the bundle means the reduction accomplished nothing and the surface grows back. Delete the code.

**Phase 26, the physical print test.** Small-format print fails in ways a PDF export does not reveal — margins, holder lips, printer non-printable zones. Sign-off requires paper.
