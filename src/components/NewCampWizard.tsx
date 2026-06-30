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
  { num: 1, label: "Camp Info",   icon: "1" },
  { num: 2, label: "Age Groups",  icon: "2" },
  { num: 3, label: "Rooms",       icon: "3" },
  { num: 4, label: "Time Slots",  icon: "4" },
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

// ─── Step 1: Camp Info ────────────────────────────────────────────────────────

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
        <h2 className="text-lg font-bold text-slate-800 mb-1">Camp Details</h2>
        <p className="text-slate-500 text-sm">Give your camp a name and set the dates.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Camp Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Creator's Camp 2027"
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400 text-slate-800 placeholder:text-slate-400"
        />
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
        <p className="text-slate-500 text-sm">Define the age groups for your camp (e.g. Younger Campers 6–9, Older Campers 10–13).</p>
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
          At least one age group is required to assign campers and activities.
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
        <p className="text-slate-500 text-sm">Where will activities be held? Add every room or location your camp uses.</p>
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

// ─── Step 4: Time Slots ───────────────────────────────────────────────────────

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
        <h2 className="text-lg font-bold text-slate-800 mb-1">Time Slots</h2>
        <p className="text-slate-500 text-sm">Define when activities run each day. You can add multiple slots (e.g. 9:20, 9:45, 10:10...).</p>
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
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Add a Time Slot</p>

        <div>
          <label className="block text-xs text-slate-500 mb-1">Label (e.g. "Period 1" or "9:20 Session")</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Period 1"
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
          + Add Time Slot ({selectedDays.length} {selectedDays.length === 1 ? "day" : "days"})
        </button>
      </div>

      {slots.length === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-4 py-3">
          At least one time slot is required to build your schedule.
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
    setLoading(true);
    setError("");
    try {
      // 1. Create camp
      const campRes = await fetch("/api/camps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });
      if (!campRes.ok) {
        const d = await campRes.json();
        throw new Error(d.error || "Failed to create camp");
      }
      const camp = await campRes.json();
      const campId = camp.id;

      // 2. Create age groups
      await Promise.all(
        ageGroups.map((ag, i) =>
          fetch(`/api/camps/${campId}/age-groups`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: ag.name,
              minAge: ag.minAge ? parseInt(ag.minAge) : undefined,
              maxAge: ag.maxAge ? parseInt(ag.maxAge) : undefined,
              color: ag.color,
              displayOrder: i,
            }),
          })
        )
      );

      // 3. Create rooms
      await Promise.all(
        rooms.map((r) =>
          fetch(`/api/camps/${campId}/rooms`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: r.name, capacity: parseInt(r.capacity) }),
          })
        )
      );

      // 4. Create session templates
      await Promise.all(
        slots.map((s) =>
          fetch(`/api/camps/${campId}/session-templates`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: s.label,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
            }),
          })
        )
      );

      onCreated(campId, name.trim());
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
            <h1 className="font-bold text-xl text-slate-800">Create New Camp</h1>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 text-sm">✕</button>
          </div>
          <StepIndicator current={step} />
        </div>

        {/* Step content */}
        <div className="px-6 pb-2 min-h-[320px]">
          {step === 1 && <Step1 name={name} setName={setName} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />}
          {step === 2 && <Step2 groups={ageGroups} setGroups={setAgeGroups} />}
          {step === 3 && <Step3 rooms={rooms} setRooms={setRooms} />}
          {step === 4 && <Step4 slots={slots} setSlots={setSlots} />}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {/* Footer */}
        <div className="px-6 py-5 border-t border-slate-100 flex items-center justify-between">
          <div>
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                ← Back
              </button>
            ) : (
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-600">
                Cancel
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Step {step} of {STEPS.length}</span>
            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                className="minimal-button-primary disabled:opacity-40"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={loading || slots.length === 0}
                className="minimal-button-primary disabled:opacity-40"
              >
                {loading ? "Creating..." : "Create Camp"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
