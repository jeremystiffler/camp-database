"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgeGroupDraft {
  name: string;
  minAge: string;
  maxAge: string;
  color: string;
}

interface RoomDraft {
  name: string;
  capacity: string;
}

interface TimeSlotDraft {
  label: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const AGE_COLORS = [
  "#64748B", "#78716C", "#6B7D5F", "#7A8060",
  "#A1624A", "#9A7A3D", "#607A8C", "#7A667A",
];

const STEPS = [
  { num: 1, label: "Program Info",   icon: "1" },
  { num: 2, label: "Age Groups",  icon: "2" },
  { num: 3, label: "Rooms",       icon: "3" },
  { num: 4, label: "Time Blocks",  icon: "4" },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.num} className="flex items-center gap-1">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            s.num === current
              ? "bg-slate-900 text-white shadow-sm"
              : s.num < current
              ? "bg-stone-200 text-stone-700"
              : "bg-slate-100 text-slate-400"
          }`}>
            <span>{s.icon}</span>
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-6 h-px ${s.num < current ? "bg-stone-400" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Program Info ────────────────────────────────────────────────────────

function Step1({
  name, setName,
  startDate, setStartDate,
  endDate, setEndDate,
}: {
  name: string; setName: (v: string) => void;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Program Details</h2>
        <p className="text-slate-500 text-sm">Give your program a name and set the dates.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Program Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          aria-describedby={!name.trim() ? "program-name-required" : undefined}
          placeholder="e.g. Creator's Program 2027"
          className={`w-full px-4 py-2.5 border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30 text-slate-800 placeholder:text-slate-400 ${name.trim() ? "border-slate-200 focus:border-forest-400" : "border-red-300 focus:border-red-400"}`}
        />
        {!name.trim() && <p id="program-name-required" className="mt-1.5 text-xs font-semibold text-red-700">Add a program name to continue.</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Age Groups ───────────────────────────────────────────────────────

function Step2({
  groups,
  setGroups,
}: {
  groups: AgeGroupDraft[];
  setGroups: (v: AgeGroupDraft[]) => void;
}) {
  const [name, setName] = useState("");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [color, setColor] = useState(AGE_COLORS[0]);

  const add = () => {
    if (!name.trim()) return;
    setGroups([...groups, { name: name.trim(), minAge, maxAge, color }]);
    setName("");
    setMinAge("");
    setMaxAge("");
    setColor(AGE_COLORS[groups.length % AGE_COLORS.length]);
  };

  const remove = (i: number) => setGroups(groups.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Age Groups</h2>
        <p className="text-slate-500 text-sm">Define the age groups for your program (e.g. Younger Participants 6–9, Older Participants 10–13).</p>
      </div>

      {/* Existing groups */}
      {groups.length > 0 && (
        <div className="space-y-2">
          {groups.map((g, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="ui-age-dot w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                <span className="font-medium text-slate-800 text-sm">{g.name}</span>
                {(g.minAge || g.maxAge) && (
                  <span className="text-xs text-slate-400">
                    {g.minAge || "?"} – {g.maxAge || "?"} yrs
                  </span>
                )}
              </div>
              <button onClick={() => remove(i)} className="text-slate-300 hover:text-red-500 transition-colors text-sm">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Add a Group</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3 sm:col-span-1">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Group name *"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30 bg-white text-slate-800 placeholder:text-slate-400"
            />
          </div>
          <div>
            <input
              type="number"
              value={minAge}
              onChange={(e) => setMinAge(e.target.value)}
              placeholder="Min age"
              min={1} max={99}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30 bg-white text-slate-800 placeholder:text-slate-400"
            />
          </div>
          <div>
            <input
              type="number"
              value={maxAge}
              onChange={(e) => setMaxAge(e.target.value)}
              placeholder="Max age"
              min={1} max={99}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30 bg-white text-slate-800 placeholder:text-slate-400"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 flex-wrap flex-1">
            {AGE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`ui-age-dot w-6 h-6 rounded-full border-2 transition-transform ${color === c ? "border-slate-900 scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={add}
            disabled={!name.trim()}
            className="px-4 py-2 bg-forest-500 text-white rounded-xl text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      </div>

      {groups.length === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-4 py-3">
          At least one age group is required to assign participants and activities.
        </p>
      )}
    </div>
  );
}

// ─── Step 3: Rooms ────────────────────────────────────────────────────────────

function Step3({
  rooms,
  setRooms,
}: {
  rooms: RoomDraft[];
  setRooms: (v: RoomDraft[]) => void;
}) {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("30");

  const add = () => {
    if (!name.trim()) return;
    setRooms([...rooms, { name: name.trim(), capacity }]);
    setName("");
    setCapacity("30");
  };

  const remove = (i: number) => setRooms(rooms.filter((_, idx) => idx !== i));
  const updateRoom = (i: number, data: Partial<RoomDraft>) => {
    setRooms(rooms.map((room, idx) => idx === i ? { ...room, ...data } : room));
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Rooms & Locations</h2>
        <p className="text-slate-500 text-sm">Where will activities be held? Add every room or location your program uses.</p>
      </div>

      {rooms.length > 0 && (
        <div className="space-y-2">
          {rooms.map((r, i) => (
            <div key={i} className="grid gap-2 bg-slate-50 rounded-xl px-4 py-3 sm:grid-cols-[1fr_90px_auto] sm:items-end">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Room / location name</span>
                <input
                  type="text"
                  value={r.name}
                  onChange={(e) => updateRoom(i, { name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Capacity</span>
                <input
                  type="number"
                  min={1}
                  value={r.capacity}
                  onChange={(e) => updateRoom(i, { capacity: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30"
                />
              </label>
              <button onClick={() => remove(i)} className="text-slate-300 hover:text-red-500 transition-colors text-sm sm:pb-2" title="Remove room">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Add a Room</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Room name (e.g. Main Hall) *"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30 bg-white text-slate-800 placeholder:text-slate-400"
          />
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            min={1}
            placeholder="Cap"
            className="w-20 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30 bg-white text-slate-800 placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={add}
            disabled={!name.trim()}
            className="px-4 py-2 bg-forest-500 text-white rounded-xl text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      </div>

      {rooms.length === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-4 py-3">
          At least one room is required before you can create activities.
        </p>
      )}
    </div>
  );
}

// ─── Step 4: Time Blocks ──────────────────────────────────────────────────────

function Step4({
  slots,
  setSlots,
}: {
  slots: TimeSlotDraft[];
  setSlots: (v: TimeSlotDraft[]) => void;
}) {
  const [label, setLabel] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:45");

  const toggleDay = (d: number) =>
    setSelectedDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());

  const add = () => {
    if (!label.trim() || !startTime || !endTime || selectedDays.length === 0) return;
    const newSlots = selectedDays.map((d) => ({
      label: label.trim(),
      dayOfWeek: d,
      startTime,
      endTime,
    }));
    setSlots([...slots, ...newSlots]);
    setLabel("");
    // Keep times for easy repeat entry
  };

  const remove = (i: number) => setSlots(slots.filter((_, idx) => idx !== i));

  // Group for display: by label+startTime
  const grouped = slots.reduce<Record<string, TimeSlotDraft[]>>((acc, s) => {
    const key = `${s.label}|${s.startTime}|${s.endTime}`;
    acc[key] = [...(acc[key] || []), s];
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Time Blocks</h2>
        <p className="text-slate-500 text-sm">Define when activities run each day. You can add multiple time blocks (e.g. 9:20, 9:45, 10:10...).</p>
      </div>

      {/* Existing slots grouped */}
      {Object.entries(grouped).length > 0 && (
        <div className="space-y-2">
          {Object.entries(grouped).map(([key, group]) => {
            const first = group[0];
            const firstIdx = slots.findIndex((s) => s.label === first.label && s.startTime === first.startTime && s.endTime === first.endTime);
            return (
              <div key={key} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-medium text-slate-800 text-sm">{first.label}</span>
                  <span className="text-xs text-slate-500 font-mono">{first.startTime} – {first.endTime}</span>
                  <div className="flex gap-1">
                    {group.map((s) => (
                      <span key={s.dayOfWeek} className="text-xs bg-sky-100 text-sky-700 rounded px-1.5 py-0.5 font-semibold">
                        {DAY_SHORT[s.dayOfWeek]}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => {
                    // remove all slots matching this group
                    setSlots(slots.filter((s) => !(s.label === first.label && s.startTime === first.startTime && s.endTime === first.endTime)));
                  }}
                  className="text-slate-300 hover:text-red-500 transition-colors text-sm"
                >✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
      <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Add a Time Block</p>

        <div>
          <label className="block text-xs text-slate-500 mb-1">Time block name (e.g. "Morning session")</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Morning session"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30 bg-white text-slate-800 placeholder:text-slate-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30 bg-white text-slate-800 placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">End Time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30 bg-white text-slate-800 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-2">Days of the Week</label>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((day, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  selectedDays.includes(i)
                    ? "bg-sky-500 text-white border-sky-500"
                    : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
                }`}
              >
                {DAY_SHORT[i]}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={add}
          disabled={!label.trim() || !startTime || !endTime || selectedDays.length === 0}
          className="w-full py-2 bg-forest-500 text-white rounded-xl text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-40"
        >
          + Add Time Block ({selectedDays.length} {selectedDays.length === 1 ? "day" : "days"})
        </button>
      </div>

      {slots.length === 0 && (
        <p id="time-block-required" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
          Add at least one time block to continue.
        </p>
      )}
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function NewCampWizard({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (campId: string, campName: string) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Step 2
  const [ageGroups, setAgeGroups] = useState<AgeGroupDraft[]>([]);

  // Step 3
  const [rooms, setRooms] = useState<RoomDraft[]>([]);

  // Step 4
  const [slots, setSlots] = useState<TimeSlotDraft[]>([]);

  const canNext = () => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return ageGroups.length > 0;
    if (step === 3) return rooms.length > 0;
    return true;
  };

  const handleFinish = async () => {
    if (!name.trim()) {
      setError("Add a program name to continue.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const campRes = await fetch("/api/camps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), startDate: startDate || undefined, endDate: endDate || undefined }),
      });
      if (!campRes.ok) {
        const d = await campRes.json();
        throw new Error(d.error || "Failed to create program");
      }
      const camp = await campRes.json();
      onCreated(camp.id, name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
        {/* Header */}
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-600">New Program</p>
              <h1 className="font-bold text-xl text-slate-800">Name your program</h1>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 text-sm">✕</button>
          </div>
          <p className="mb-5 text-sm text-slate-500">Create the draft now, then complete age groups, rooms, time blocks, staff, activities, and registration in one guided Setup flow.</p>
        </div>

        {/* Step content */}
        <div className="px-6 pb-2 min-h-[220px]">
          <Step1 name={name} setName={setName} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {/* Footer */}
        <div className="px-6 py-5 border-t border-slate-100 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-600">Cancel</button>
          <div className="text-right">
            {!name.trim() && <p id="program-name-required" className="mb-1 text-xs font-semibold text-red-700">Add a program name to continue.</p>}
            <button onClick={handleFinish} disabled={loading || !name.trim()} aria-describedby={!name.trim() ? "program-name-required" : undefined} title={!name.trim() ? "Add a program name to create your program." : undefined} className="minimal-button-primary disabled:cursor-not-allowed disabled:opacity-40">
              {loading ? "Creating..." : "Create & continue to Setup →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
