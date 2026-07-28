import { effectiveCapacity, hasUnsetLimit } from "@/lib/capacity-rules";

/**
 * Class assignment — AUTHORITATIVE (assignment-and-balancing spec §3).
 *
 * Pure and deterministic. No database access, no clock, no randomness: the same
 * input always produces the same output, because an organiser who cannot explain
 * why a child got a class will not trust the feature.
 *
 * Not an optimiser. Good, fast, and explainable beats optimal.
 */

export type AssignmentCourse = {
  id: string;
  name: string;
  /** Null means no limit set. See UNLIMITED CLASSES below. */
  cap: number | null;
  minEnrollment: number;
  /** active | hidden | cancelled — only active is ever assigned into. */
  status: string;
  /**
   * Seats already taken before this run, PER BLOCK. A course that runs in three
   * time blocks is three separate offerings of `cap` seats each, so occupancy
   * must be tracked per block — not once for the whole course. Missing entries
   * count as zero.
   */
  enrolledByBlock?: Record<string, number>;
  /** Age groups eligible for this course. Empty means open to all groups. */
  ageGroupIds: string[];
  /** Time blocks this course runs in. */
  blockIds: string[];
  /** Optional activity type, used only for the variety nudge. */
  category?: string | null;
};

export type AssignmentParticipant = {
  id: string;
  /** Null means no age group recorded; such a participant is eligible only for
   *  courses that are themselves open to all groups. */
  ageGroupId: string | null;
  /** Up to three course ids. Soft input: outscores fill-first, never overrides
   *  a hard constraint. */
  preferences: string[];
};

export type Assignment = {
  participantId: string;
  blockId: string;
  courseId: string;
  /** Winning score, retained so the explanation is derived from the real result. */
  score: number;
  /** One line for §7.4, e.g. "Ellie asked for this one." */
  reason: string;
  /** True when this assignment satisfied a stated preference. */
  fromPreference: boolean;
};

export type AssignmentGap = {
  participantId: string;
  blockId: string;
  /** Why nothing could be assigned — this becomes the blocking issue message. */
  cause: "all_full" | "no_eligible_course";
};

export type AssignmentResult = {
  assignments: Assignment[];
  gaps: AssignmentGap[];
  /**
   * Final seat counts keyed `courseId|blockId`, including seats taken before
   * this run. Keyed per block because each block is a separate offering.
   */
  finalEnrolled: Record<string, number>;
};

/** Key for per-block occupancy. Exported so callers can read finalEnrolled. */
export function seatKey(courseId: string, blockId: string): string {
  return `${courseId}|${blockId}`;
}

export type AssignmentInput = {
  /** Time blocks, in the order they should be filled. */
  blockIds: string[];
  courses: AssignmentCourse[];
  participants: AssignmentParticipant[];
  /** Stable seed, normally the event id. Guarantees a repeatable shuffle. */
  seed: string;
};

/**
 * UNLIMITED CLASSES (cap === null) — resolution of the conflict between this
 * spec and the capacity rule that a blank limit means unlimited.
 *
 * The spec's expressions assume cap is a number and each breaks differently on
 * null: `enrolled < cap` is false forever, `enrolled / cap` is Infinity, and
 * summing caps contributes zero seats. An uncapped class is therefore treated
 * as an OVERFLOW VALVE:
 *
 *   - it always has room, so it can absorb a participant who would otherwise
 *     have nowhere to be;
 *   - it is only ever considered when NO capped class has room.
 *
 * The second rule is a hard tier, not a score penalty. Scoring alone is not
 * enough: an empty capped class and an empty uncapped class both score 0 on
 * fill-first, so a tie-break would send children into the uncapped class and
 * the capped one would never open — starving exactly the classes that need
 * bodies to become viable.
 *
 * That combination makes an uncapped class the safety net that keeps the
 * "room for everyone" promise literally true rather than a liability.
 */
const FILL_WEIGHT = 300;
const PREFERENCE_WEIGHT = 1000;
const RESCUE_WEIGHT = 150;
const RESCUE_MAX_SHORTFALL = 2;
const VARIETY_WEIGHT = 40;

/** FNV-1a. Matches lib/activity-color.ts so hashing behaves consistently. */
function hash(value: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193) >>> 0;
  }
  return result >>> 0;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** A course with no age groups listed is open to every group. */
export function isAgeEligible(course: AssignmentCourse, participant: AssignmentParticipant): boolean {
  if (course.ageGroupIds.length === 0) return true;
  if (!participant.ageGroupId) return false;
  return course.ageGroupIds.includes(participant.ageGroupId);
}

/** Seats left. Infinity for an uncapped class (the overflow valve). */
export function remainingSeats(course: AssignmentCourse, enrolled: number): number {
  return effectiveCapacity(course) - enrolled;
}

export function hasRoom(course: AssignmentCourse, enrolled: number): boolean {
  return remainingSeats(course, enrolled) > 0;
}

/**
 * Candidate score (§3.2). Higher wins.
 *
 * Fill-first is the core requirement and is deliberately the opposite of
 * spreading evenly — even spreading is what produces a dozen classes holding
 * two children each.
 */
export function scoreCourse(
  course: AssignmentCourse,
  participant: AssignmentParticipant,
  enrolled: number,
  assignedCategories: Set<string>,
): number {
  let score = 0;

  // 1. A stated preference outranks everything else.
  if (participant.preferences.includes(course.id)) score += PREFERENCE_WEIGHT;

  // 2. Fill-first. An uncapped class has no meaningful ratio and scores 0 here,
  //    so it is only ever chosen when nothing capped has room.
  if (!hasUnsetLimit(course)) {
    const capacity = effectiveCapacity(course);
    if (capacity > 0) score += (enrolled / capacity) * FILL_WEIGHT;
  }

  // 3. Nudge the nearly-viable over the line; leave the hopeless alone. A class
  //    two short of viable gets help, a class needing six more does not get
  //    propped up with children who would rather be elsewhere.
  if (enrolled < course.minEnrollment) {
    const shortfall = course.minEnrollment - enrolled;
    if (shortfall <= RESCUE_MAX_SHORTFALL) score += RESCUE_WEIGHT;
  }

  // 4. Variety across the participant's day. Inert until courses carry a
  //    category — no schema field exists yet, so this contributes nothing
  //    rather than guessing at a grouping.
  if (course.category && !assignedCategories.has(course.category)) score += VARIETY_WEIGHT;

  return score;
}

/** One line explaining the winning choice (§7.4). */
function explain(
  course: AssignmentCourse,
  fromPreference: boolean,
  enrolledBefore: number,
  isNewActivity: boolean,
): string {
  if (fromPreference) return "You asked for this one.";
  if (enrolledBefore < course.minEnrollment) {
    return "Assigned because this class needed a few more to run.";
  }
  if (isNewActivity) return "Assigned because it had room and this activity hadn't been tried yet.";
  return "Assigned because it had room.";
}

type Working = {
  enrolled: Map<string, number>;
  assignedNames: Map<string, Set<string>>;
  assignedCategories: Map<string, Set<string>>;
  satisfied: Map<string, number>;
};

/**
 * Assign every participant a complete, valid, conflict-free day.
 *
 * Hard constraints (§3.1), never violated:
 *   - a class never exceeds its cap
 *   - the participant's age group is eligible
 *   - exactly one course per participant per block
 *   - the same course name is never assigned twice to one participant
 *   - hidden and cancelled courses are never assigned into
 *
 * A participant with no valid option is left unassigned and reported as a gap.
 * Nothing is ever force-placed.
 */
export function assignParticipants(input: AssignmentInput): AssignmentResult {
  const { blockIds, courses, participants, seed } = input;

  const assignable = courses.filter((course) => course.status === "active");
  const byBlock = new Map<string, AssignmentCourse[]>();
  for (const blockId of blockIds) {
    byBlock.set(
      blockId,
      assignable.filter((course) => course.blockIds.includes(blockId)),
    );
  }

  const work: Working = {
    // Seed occupancy per course-and-block, since each block is its own offering.
    enrolled: new Map(
      courses.flatMap((course) =>
        course.blockIds.map(
          (blockId) =>
            [seatKey(course.id, blockId), course.enrolledByBlock?.[blockId] ?? 0] as [string, number],
        ),
      ),
    ),
    assignedNames: new Map(participants.map((participant) => [participant.id, new Set<string>()])),
    assignedCategories: new Map(participants.map((participant) => [participant.id, new Set<string>()])),
    satisfied: new Map(participants.map((participant) => [participant.id, 0])),
  };

  const assignments: Assignment[] = [];
  const gaps: AssignmentGap[] = [];

  for (const blockId of blockIds) {
    const candidates = byBlock.get(blockId) ?? [];

    // §3.3 — process the least-satisfied participants first so the same children
    // do not absorb the leftovers in every block. Ties broken by a seeded
    // shuffle keyed on event + block, which keeps runs reproducible.
    const ordered = [...participants].sort((left, right) => {
      const bySatisfaction = (work.satisfied.get(left.id) ?? 0) - (work.satisfied.get(right.id) ?? 0);
      if (bySatisfaction !== 0) return bySatisfaction;
      const leftRank = hash(`${seed}|${blockId}|${left.id}`);
      const rightRank = hash(`${seed}|${blockId}|${right.id}`);
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });

    for (const participant of ordered) {
      const takenNames = work.assignedNames.get(participant.id) ?? new Set<string>();
      const categories = work.assignedCategories.get(participant.id) ?? new Set<string>();

      const eligible = candidates.filter(
        (course) =>
          isAgeEligible(course, participant) && !takenNames.has(normalizeName(course.name)),
      );

      if (eligible.length === 0) {
        gaps.push({ participantId: participant.id, blockId, cause: "no_eligible_course" });
        continue;
      }

      const withRoom = eligible.filter((course) =>
        hasRoom(course, work.enrolled.get(seatKey(course.id, blockId)) ?? 0),
      );

      if (withRoom.length === 0) {
        gaps.push({ participantId: participant.id, blockId, cause: "all_full" });
        continue;
      }

      // Uncapped classes are a hard second tier, not merely a low score. A
      // capped class with room always wins, so classes that need bodies to
      // reach viability are never starved by the overflow valve.
      //
      // A stated preference outranks the tier: if the family asked for a class,
      // an uncapped one still wins. Preference beats fill-first everywhere else
      // and must beat it here too.
      const preferred = withRoom.filter((course) => participant.preferences.includes(course.id));
      const capped = withRoom.filter((course) => !hasUnsetLimit(course));
      const tier = preferred.length > 0 ? withRoom : capped.length > 0 ? capped : withRoom;

      let best: AssignmentCourse | null = null;
      let bestScore = Number.NEGATIVE_INFINITY;
      let bestRank = 0;

      for (const course of tier) {
        const enrolled = work.enrolled.get(seatKey(course.id, blockId)) ?? 0;
        const score = scoreCourse(course, participant, enrolled, categories);
        const rank = hash(`${seed}|${blockId}|${course.id}`);
        // Deterministic tie-break: seeded rank, then course id.
        const wins =
          score > bestScore ||
          (score === bestScore &&
            (rank < bestRank || (rank === bestRank && best !== null && course.id < best.id)));
        if (best === null || wins) {
          best = course;
          bestScore = score;
          bestRank = rank;
        }
      }

      if (!best) {
        gaps.push({ participantId: participant.id, blockId, cause: "all_full" });
        continue;
      }

      const enrolledBefore = work.enrolled.get(seatKey(best.id, blockId)) ?? 0;
      const fromPreference = participant.preferences.includes(best.id);
      const isNewActivity = Boolean(best.category) && !categories.has(best.category as string);

      assignments.push({
        participantId: participant.id,
        blockId,
        courseId: best.id,
        score: bestScore,
        reason: explain(best, fromPreference, enrolledBefore, isNewActivity),
        fromPreference,
      });

      work.enrolled.set(seatKey(best.id, blockId), enrolledBefore + 1);
      takenNames.add(normalizeName(best.name));
      if (best.category) categories.add(best.category);
      if (fromPreference) {
        work.satisfied.set(participant.id, (work.satisfied.get(participant.id) ?? 0) + 1);
      }
    }
  }

  return {
    assignments,
    gaps,
    finalEnrolled: Object.fromEntries(work.enrolled),
  };
}
