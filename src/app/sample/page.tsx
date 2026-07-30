"use client";

import Link from "next/link";
import { useState } from "react";
import { OperationsGrid, type GridAgeGroup, type GridBlock, type GridCourse } from "@/components/OperationsGrid";
import { SSPLogo } from "@/components/SSPLogo";

const blocks: GridBlock[] = [
  { id: "b1", label: "Opening", startTime: "09:00", endTime: "09:35" },
  { id: "b2", label: "Rotation 1", startTime: "09:45", endTime: "10:25" },
  { id: "b3", label: "Rotation 2", startTime: "10:35", endTime: "11:15" },
  { id: "b4", label: "Lunch", startTime: "11:25", endTime: "12:05" },
  { id: "b5", label: "Rotation 3", startTime: "12:15", endTime: "12:55" },
];

const ageGroups: GridAgeGroup[] = [
  { id: "early", name: "Early elementary", color: "#3B82F6" },
  { id: "upper", name: "Upper elementary", color: "#8B5CF6" },
  { id: "mixed", name: "All ages", color: "#10B981" },
];

const initialCourses: GridCourse[] = [
  { id: "art", name: "Creative Studio", cap: 16, color: "#3B82F6", ageGroupId: "early", room: { id: "art-room", name: "Art room", capacity: 18 }, sessions: [{ id: "s-art", sessionTemplateId: "b2", enrolledCount: 12 }] },
  { id: "games", name: "Outdoor Games", cap: 20, color: "#D97706", ageGroupId: "upper", room: { id: "field", name: "Field", capacity: 30 }, sessions: [{ id: "s-games", sessionTemplateId: "b3", enrolledCount: 18 }] },
  { id: "music", name: "Music Lab", cap: 14, color: "#7C3AED", ageGroupId: "early", room: { id: "music-room", name: "Music room", capacity: 16 }, sessions: [{ id: "s-music", sessionTemplateId: "b5", enrolledCount: 10 }] },
  { id: "science", name: "Discovery Lab", cap: 12, color: "#059669", ageGroupId: "upper", room: { id: "lab", name: "Lab", capacity: 12 }, sessions: [{ id: "s-science", sessionTemplateId: "b2", enrolledCount: 12 }] },
  { id: "drama", name: "Drama Workshop", cap: 18, color: "#DB2777", ageGroupId: "mixed", room: { id: "stage", name: "Stage", capacity: 24 }, sessions: [{ id: "s-drama", sessionTemplateId: "b3", enrolledCount: 9 }] },
  { id: "robots", name: "Robotics", cap: 10, color: "#2563EB", ageGroupId: "upper", room: { id: "stem", name: "STEM room", capacity: 12 }, sessions: [{ id: "s-robots", sessionTemplateId: "b5", enrolledCount: 8 }] },
  { id: "story", name: "Story Circle", cap: 15, color: "#9333EA", ageGroupId: "early", room: { id: "library", name: "Library", capacity: 18 }, sessions: [{ id: "s-story", sessionTemplateId: "b3", enrolledCount: 13 }] },
  { id: "service", name: "Service Project", cap: 24, color: "#0F766E", ageGroupId: "mixed", room: { id: "hall", name: "Fellowship hall", capacity: 40 }, sessions: [{ id: "s-service", sessionTemplateId: "b5", enrolledCount: 19 }] },
];

export default function SamplePage() {
  const [courses, setCourses] = useState<GridCourse[]>(initialCourses);
  const [announcement, setAnnouncement] = useState("Sample loaded. Choose a filled or empty cell to explore it.");

  const addSession = async ({ courseId, blockId, startTime, endTime }: { courseId: string; blockId: string; startTime: string; endTime: string }) => {
    setCourses(current => current.map(course => course.id === courseId
      ? { ...course, sessions: [...(course.sessions || []), { id: `sample-${courseId}-${blockId}`, sessionTemplateId: blockId, enrolledCount: 0 }] }
      : course));
    setAnnouncement("Added to the sample schedule. This change exists only in your browser.");
    return true;
  };

  const removeSession = async ({ courseId, sessionId }: { courseId: string; sessionId: string }) => {
    setCourses(current => current.map(course => course.id === courseId
      ? { ...course, sessions: (course.sessions || []).filter(session => session.id !== sessionId) }
      : course));
    setAnnouncement("Removed from the sample schedule. Refreshing the page restores the original data.");
    return true;
  };

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--text)]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3 font-extrabold text-[var(--text-strong)]"><SSPLogo size={38} /><span>Simple Schedule Pro</span></Link>
        <Link href="/signup" className="rounded-xl bg-[var(--brand-strong)] px-4 py-2.5 text-sm font-extrabold text-white shadow-sm">Start free trial</Link>
      </nav>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-8">
        <div className="rounded-2xl border-l-4 border-[var(--brand-rail)] bg-[var(--brand-wash)] p-6">
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--brand-ink)]">No signup required</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.032em] text-[var(--brand-ink)] sm:text-5xl">Explore a sample event.</h1>
          <p className="mt-3 max-w-3xl text-[var(--text)]">Eight activities, three age groups, and five time blocks. Search, sort, filter, or choose any grid cell to view details and make a temporary change.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => { setCourses(initialCourses); setAnnouncement("Sample reset to its original schedule."); }} className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-bold text-[var(--text-strong)]">Reset sample</button>
            <span className="text-sm font-semibold text-[var(--text-muted)]">Nothing here is saved or connected to a real organization.</span>
          </div>
        </div>

        <p className="mt-5 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[var(--text-muted)] shadow-sm" role="status" aria-live="polite">{announcement}</p>
        <section className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm" aria-label="Interactive sample schedule">
          <OperationsGrid courses={courses} blocks={blocks} ageGroups={ageGroups} interactive onAddSession={addSession} onRemoveSession={removeSession} />
        </section>

        <div className="mt-8 flex flex-col items-center rounded-xl bg-[var(--brand-primary)] p-8 text-center text-white sm:flex-row sm:justify-between sm:text-left">
          <div><h2 className="text-2xl font-extrabold">Ready to build your own event?</h2><p className="mt-1 text-white/85">Your 14-day trial needs no credit card.</p></div>
          <Link href="/signup" className="mt-5 rounded-xl bg-white px-5 py-3 font-extrabold text-slate-950 shadow-sm sm:mt-0">Start free trial</Link>
        </div>
      </section>
    </main>
  );
}
