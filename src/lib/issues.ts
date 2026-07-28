/**
 * The issue engine — master build order phase 18b.
 *
 * ONE module, ONE string per condition. The dashboard summary strip, the sidebar
 * status dots, the activities table and the registration form all read from here.
 * Before this existed the same condition produced different wording in different
 * files ("has no limit set" vs "has no class limit set"), which is exactly the
 * disagreement §7 forbids.
 *
 * Pure: no database access, no framework imports, no I/O. Callers pass a snapshot
 * and get issues back, which makes every rule testable in isolation.
 *
 * SEVERITY IS A CONTRACT, not a hint. The split follows the dashboard spec §2.1:
 *
 *   blocking  — registration may not open. These are the conditions under which
 *               the event as configured cannot physically run: enrolment above
 *               the class limit, one room double-booked, one teacher in two
 *               places, or more participants than seats in a block.
 *   warning   — incomplete but runnable. Someone must act, families can register.
 *   advisory  — descriptive. Never blocks anything, ever. Room mismatches and
 *               missing limits live here per master build order §3.7, because a
 *               forgotten room number must never become the thing that stops a
 *               class from being scheduled.
 *
 * §3.7 overrides room capacity as an ENROLMENT CEILING only. It does not touch
 * double-booking: a room that cannot hold two activities at once is a scheduling
 * fact, not a capacity estimate.
 *
 * Adding a blocking code is a product decision. Do not promote an advisory to
 * blocking to make a number look better on a dashboard.
 */

import { effectiveCapacity, formatCapacity, hasUnsetLimit, exceedsRoom } from "@/lib/capacity-rules";

export type IssueSeverity = "blocking" | "warning" | "advisory";

export type IssueCode =
  // Blocking — the event as configured cannot run
  | "over-capacity"
  | "room-clash"
  | "teacher-clash"
  | "seat-shortfall"
  // Warnings — incomplete but runnable
  | "no-teacher"
  | "unscheduled"
  | "empty"
  | "age-group-gap"
  // Advisories — never blocking (§3.7)
  | "cap-above-room"
  | "roomless"
  | "no-limit-set";

export type Issue = {
  code: IssueCode;
  severity: IssueSeverity;
  /** The one canonical sentence for this condition. Never rewritten downstream. */
  message: string;
  /** The activity this concerns, when it concerns exactly one. */
  courseId?: string;
  /** The time block this concerns, when it concerns exactly one. */
  blockId?: string;
  /** Stable identity for dedupe and for React keys. */
  key: string;
};

/**
 * Which codes prevent registration from opening (dashboard spec §2.1). Every one
 * describes an event that cannot physically run as configured. Room capacity
 * mismatches are deliberately NOT here — see §3.7.
 */
export const BLOCKING_CODES: readonly IssueCode[] = [
  "over-capacity",
  "room-clash",
  "teacher-clash",
  "seat-shortfall",
];

export type IssueSession = {
  id: string;
  sessionTemplateId: string | null;
  enrolledCount: number | null;
  roomId?: string | null;
  status?: string | null;
  sessionTeachers?: { personId: string }[];
};

export type IssueCourse = {
  id: string;
  name: string;
  cap: number | null;
  heldSeats?: number | null;
  status?: string | null;
  room?: { id: string; name: string; capacity: number | null } | null;
  courseTeachers?: { personId?: string; person?: { id: string; firstName: string; lastName: string } }[];
  courseAgeGroups?: { ageGroupId: string }[];
  courseSessionTemplates?: { sessionTemplateId: string }[];
  sessions?: IssueSession[];
  /** Warnings the organiser has explicitly dismissed. */
  attentionDismissals?: string[];
};

export type IssueBlock = {
  id: string;
  label?: string | null;
  dayOfWeek?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  /**
   * True for whole-event blocks (opening assembly, lunch) where nobody chooses an
   * activity. Coverage and shortfall rules skip these: everyone is already
   * accounted for, so "Older has nothing at Closing Assembly" is a false alarm.
   */
  mandatory?: boolean;
};

export type IssueAgeGroup = {
  id: string;
  name: string;
  /**
   * A group that does not take classes at all — a daycare or nursery band that
   * is enrolled in the event but never picks activities. Coverage and shortfall
   * rules skip these entirely: "Pre K has nothing at Session 3" is a false
   * alarm thirty times over when Pre K was never meant to be scheduled.
   */
  noSchedule?: boolean;
};

/**
 * Which age groups actually take classes. Everything about coverage is measured
 * against these, never against the raw list.
 */
export function schedulableGroups(ageGroups: IssueAgeGroup[]): IssueAgeGroup[] {
  return ageGroups.filter((group) => !group.noSchedule);
}

/**
 * Is this activity open to everyone?
 *
 * Two ways to say it, and they mean the same thing (owner's ruling, 2026-07-28):
 *   - no age tags at all, or
 *   - tagged with every schedulable group.
 *
 * The second is the common case in real data: an organiser ticks all the boxes
 * to mean "anyone may come", not "these N specific groups". Snacktivities is
 * tagged Older + Younger, which is every group that takes classes, so it is
 * all-ages — not a two-group restriction that happens to exclude the daycare.
 *
 * NOTE ON FUTURE GROUPS: this is evaluated against the CURRENT schedulable list,
 * so adding a brand-new group makes a previously all-ages activity stop covering
 * it until it is re-tagged. Making that intent survive new groups needs a stored
 * flag on Course rather than a derivation — see the note in the phase log.
 */
export function isAllAges(
  course: { courseAgeGroups?: { ageGroupId: string }[] },
  schedulable: IssueAgeGroup[],
): boolean {
  const tags = (course.courseAgeGroups ?? []).map((entry) => entry.ageGroupId);
  if (tags.length === 0) return true;
  if (schedulable.length === 0) return true;
  return schedulable.every((group) => tags.includes(group.id));
}

/** Can this activity be chosen by a child in this age group? */
export function coversGroup(
  course: { courseAgeGroups?: { ageGroupId: string }[] },
  groupId: string,
  schedulable: IssueAgeGroup[],
): boolean {
  if (isAllAges(course, schedulable)) return true;
  return (course.courseAgeGroups ?? []).some((entry) => entry.ageGroupId === groupId);
}

export type IssueRoom = { id: string; name: string };

export type IssuePerson = { id: string; firstName: string; lastName: string };

export type IssueInput = {
  courses: IssueCourse[];
  blocks?: IssueBlock[];
  ageGroups?: IssueAgeGroup[];
  rooms?: IssueRoom[];
  persons?: IssuePerson[];
  /** Registered participants per age group id, for seat-shortfall arithmetic. */
  campersByAgeGroup?: Record<string, number>;
};

/** Dismissal keys as stored on Course.attentionDismissals. */
const DISMISSAL_FOR: Partial<Record<IssueCode, string>> = {
  "no-teacher": "teacher",
  unscheduled: "schedule",
  "over-capacity": "capacity",
  "no-limit-set": "limit",
};

function isDismissed(course: IssueCourse, code: IssueCode): boolean {
  const key = DISMISSAL_FOR[code];
  if (!key) return false;
  return (course.attentionDismissals ?? []).includes(key);
}

/** A cancelled activity is not a problem to be solved. */
function isLive(course: IssueCourse): boolean {
  return course.status !== "cancelled";
}

function blockLabel(block: IssueBlock | undefined): string {
  if (!block) return "a time block";
  if (block.label && block.label.trim()) return block.label.trim();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const day = typeof block.dayOfWeek === "number" ? days[block.dayOfWeek] : null;
  const time = block.startTime ?? "";
  return [day, time].filter(Boolean).join(" ") || "a time block";
}

function personName(person: IssuePerson | undefined, id: string): string {
  if (!person) return "A teacher";
  return `${person.firstName} ${person.lastName}`.trim() || id;
}

/** Sessions that actually run. A cancelled session is not scheduled. */
function liveSessions(course: IssueCourse): IssueSession[] {
  return (course.sessions ?? []).filter((session) => session.status !== "cancelled");
}

/**
 * Every issue for this event, in a stable order: blocking first, then warnings,
 * then advisories, each alphabetically by message so the list never reshuffles
 * between renders of identical data.
 */
export function detectIssues(input: IssueInput): Issue[] {
  const { courses, blocks = [], ageGroups = [], persons = [], campersByAgeGroup = {} } = input;
  // Coverage is always measured against groups that actually take classes.
  const schedulable = schedulableGroups(ageGroups);
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const personById = new Map(persons.map((person) => [person.id, person]));
  const issues: Issue[] = [];

  const push = (issue: Omit<Issue, "key">) => {
    issues.push({
      ...issue,
      key: [issue.code, issue.courseId ?? "", issue.blockId ?? "", issue.message].join("|"),
    });
  };

  for (const course of courses) {
    if (!isLive(course)) continue;
    const sessions = liveSessions(course);
    const capacity = effectiveCapacity(course);

    // BLOCKING — enrolment above the class participant limit. Per-session: a
    // class running five times offers its limit five times over, so summing
    // enrolment across blocks would report a false overflow.
    if (Number.isFinite(capacity) && !isDismissed(course, "over-capacity")) {
      for (const session of sessions) {
        const enrolled = session.enrolledCount ?? 0;
        if (enrolled > capacity) {
          const block = session.sessionTemplateId ? blockById.get(session.sessionTemplateId) : undefined;
          push({
            code: "over-capacity",
            severity: "blocking",
            courseId: course.id,
            blockId: session.sessionTemplateId ?? undefined,
            message: `${course.name} is ${enrolled - capacity} over at ${blockLabel(block)}`,
          });
        }
      }
    }

    // WARNING — nobody is teaching it.
    if ((course.courseTeachers ?? []).length === 0 && !isDismissed(course, "no-teacher")) {
      push({
        code: "no-teacher",
        severity: "warning",
        courseId: course.id,
        message: `${course.name} has no teacher assigned`,
      });
    }

    // WARNING — it exists but never runs.
    if (
      (course.courseSessionTemplates ?? []).length === 0 &&
      sessions.length === 0 &&
      !isDismissed(course, "unscheduled")
    ) {
      push({
        code: "unscheduled",
        severity: "warning",
        courseId: course.id,
        message: `${course.name} isn't in any time block`,
      });
    }

    // WARNING — it runs but nobody signed up.
    if (sessions.length > 0 && sessions.every((session) => (session.enrolledCount ?? 0) === 0)) {
      push({
        code: "empty",
        severity: "warning",
        courseId: course.id,
        message: `Nobody has signed up for ${course.name}`,
      });
    }

    // ADVISORY — the limit exceeds what the room holds. Descriptive only: a stale
    // room number must never stop a class from being scheduled (§3.7).
    if (course.room && exceedsRoom(course, course.room) && course.room.capacity != null) {
      push({
        code: "cap-above-room",
        severity: "advisory",
        courseId: course.id,
        message: `${course.name} allows ${formatCapacity(course)}; ${course.room.name} is listed at ${course.room.capacity}`,
      });
    }

    // ADVISORY — no room. Still accepts its full limit (§3.7).
    if (!course.room) {
      push({
        code: "roomless",
        severity: "advisory",
        courseId: course.id,
        message: `${course.name} has no room assigned`,
      });
    }

    // ADVISORY — unlimited registration. Loud, but not an error: some classes
    // genuinely have no limit (§3.7).
    if (hasUnsetLimit(course) && !isDismissed(course, "no-limit-set")) {
      push({
        code: "no-limit-set",
        severity: "advisory",
        courseId: course.id,
        message: `${course.name} has no limit set and will accept unlimited registration`,
      });
    }
  }

  // WARNING — two activities in one room at the same time.
  const roomUse = new Map<string, { courseName: string; courseId: string }[]>();
  for (const course of courses) {
    if (!isLive(course)) continue;
    for (const session of liveSessions(course)) {
      // Session room falls back to the course room, which is how most events
      // assign space: once on the activity, not per session.
      const roomId = session.roomId ?? course.room?.id ?? null;
      if (!roomId || !session.sessionTemplateId) continue;
      const key = `${session.sessionTemplateId}|${roomId}`;
      const entry = roomUse.get(key) ?? [];
      // One activity occupying its own room across two sessions of the same block
      // is not a clash with itself.
      if (!entry.some((item) => item.courseId === course.id)) {
        entry.push({ courseName: course.name, courseId: course.id });
      }
      roomUse.set(key, entry);
    }
  }
  for (const [key, users] of roomUse) {
    if (users.length < 2) continue;
    const [blockId, roomId] = key.split("|");
    const roomName =
      courses.find((course) => course.room?.id === roomId)?.room?.name ??
      input.rooms?.find((room) => room.id === roomId)?.name ??
      "one room";
    const names = users.map((user) => user.courseName).sort((a, b) => a.localeCompare(b));
    push({
      code: "room-clash",
      severity: "blocking",
      blockId,
      message: `${roomName} has two activities at ${blockLabel(blockById.get(blockId))}`,
    });
  }

  // WARNING — one teacher in two places at once.
  const teacherUse = new Map<string, Set<string>>();
  const teacherCourseNames = new Map<string, Map<string, string>>();
  for (const course of courses) {
    if (!isLive(course)) continue;
    for (const session of liveSessions(course)) {
      if (!session.sessionTemplateId) continue;
      // Session teachers when set, otherwise the activity's teachers.
      const teacherIds = (session.sessionTeachers ?? []).length
        ? session.sessionTeachers!.map((entry) => entry.personId)
        : (course.courseTeachers ?? [])
            .map((entry) => entry.personId ?? entry.person?.id)
            .filter((id): id is string => Boolean(id));
      for (const personId of teacherIds) {
        const key = `${session.sessionTemplateId}|${personId}`;
        const set = teacherUse.get(key) ?? new Set<string>();
        set.add(course.id);
        teacherUse.set(key, set);
        const names = teacherCourseNames.get(key) ?? new Map<string, string>();
        names.set(course.id, course.name);
        teacherCourseNames.set(key, names);
      }
    }
  }
  for (const [key, courseIds] of teacherUse) {
    if (courseIds.size < 2) continue;
    const [blockId, personId] = key.split("|");
    const names = [...(teacherCourseNames.get(key)?.values() ?? [])].sort((a, b) => a.localeCompare(b));
    push({
      code: "teacher-clash",
      severity: "blocking",
      blockId,
      message: `${personName(personById.get(personId), personId)} is in two rooms at ${blockLabel(blockById.get(blockId))}`,
    });
  }

  // WARNING — an age group has nowhere to go in a block. An activity with no age
  // group is open to everyone, so it covers every group (same rule the grid's age
  // filter uses).
  for (const block of blocks) {
    // Whole-event blocks have no activity choice by design.
    if (block.mandatory) continue;
    // Groups that never take classes are not missing anything.
    for (const group of schedulable) {
      const covered = courses.some((course) => {
        if (!isLive(course)) return false;
        const runsHere =
          liveSessions(course).some((session) => session.sessionTemplateId === block.id) ||
          (course.courseSessionTemplates ?? []).some((entry) => entry.sessionTemplateId === block.id);
        if (!runsHere) return false;
        return coversGroup(course, group.id, schedulable);
      });
      if (!covered) {
        push({
          code: "age-group-gap",
          severity: "warning",
          blockId: block.id,
          message: `${group.name} has nothing at ${blockLabel(block)}`,
        });
      }
    }
  }

  // WARNING — more participants in an age group than seats available to them in a
  // block. Unlimited activities absorb everyone, so a block containing one is
  // never short.
  for (const block of blocks) {
    if (block.mandatory) continue;
    for (const group of schedulable) {
      const demand = campersByAgeGroup[group.id] ?? 0;
      if (demand === 0) continue;
      let seats = 0;
      let unlimited = false;
      for (const course of courses) {
        if (!isLive(course)) continue;
        if (!coversGroup(course, group.id, schedulable)) continue;
        const runsHere = liveSessions(course).some((session) => session.sessionTemplateId === block.id);
        if (!runsHere) continue;
        const capacity = effectiveCapacity(course);
        if (!Number.isFinite(capacity)) {
          unlimited = true;
          break;
        }
        seats += capacity;
      }
      if (unlimited || seats === 0) continue; // no coverage is age-group-gap's job
      if (seats < demand) {
        push({
          code: "seat-shortfall",
          severity: "blocking",
          blockId: block.id,
          message: `${blockLabel(block)} offers ${seats} seats for ${demand} ${group.name} participants`,
        });
      }
    }
  }

  const rank: Record<IssueSeverity, number> = { blocking: 0, warning: 1, advisory: 2 };
  return issues.sort(
    (left, right) => rank[left.severity] - rank[right.severity] || left.message.localeCompare(right.message),
  );
}

/** Issues that must prevent registration from opening. */
export function blockingIssues(issues: Issue[]): Issue[] {
  return issues.filter((issue) => BLOCKING_CODES.includes(issue.code));
}

/**
 * True when registration may open. Advisories and warnings deliberately do not
 * gate it — only a real overflow does (§3.7).
 */
export function canOpenRegistration(issues: Issue[]): boolean {
  return blockingIssues(issues).length === 0;
}

/** Counts per severity, for the summary strip. */
export function issueCounts(issues: Issue[]): Record<IssueSeverity, number> {
  return {
    blocking: issues.filter((issue) => issue.severity === "blocking").length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
    advisory: issues.filter((issue) => issue.severity === "advisory").length,
  };
}

/** All issues for one activity, for the row header and the activities table. */
export function issuesForCourse(issues: Issue[], courseId: string): Issue[] {
  return issues.filter((issue) => issue.courseId === courseId);
}

/** Counts per code, for the dashboard's existing attention tiles. */
export function countsByCode(issues: Issue[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const issue of issues) counts[issue.code] = (counts[issue.code] ?? 0) + 1;
  return counts;
}
