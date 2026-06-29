"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface FormField {
  id: string;
  type: "text" | "email" | "tel" | "date" | "number" | "url" | "select" | "textarea" | "checkbox" | "heading" | "subheading" | "divider" | "pageBreak";
  label: string;
  required: boolean;
  system?: boolean;
  options?: string[];
  source?: string;
  placeholder?: string;
  helpText?: string;
  checkboxDescription?: string;
}

interface AgeGroup { id: string; name: string; noSchedule?: boolean; }
interface Course {
  id: string;
  name: string;
  description?: string | null;
  cap?: number | null;
  ageGroupId?: string | null;
  courseAgeGroups?: { ageGroupId: string }[];
}
interface SessionOption {
  courseId: string;
  name: string;
  description?: string | null;
  cap?: number | null;
  enrolledCount: number;
  seatsLeft: number | null;
}
interface RegistrationSession {
  id: string;
  label?: string | null;
  dayOfWeek?: number | null;
  startTime: string;
  endTime: string;
  mandatory: boolean;
  mandatorySessions?: {
    id: string;
    title: string;
    ageGroupId: string;
    room?: { name: string } | null;
    leader?: { firstName: string; lastName: string } | null;
  }[];
  optionCountsByAgeGroup: Record<string, number>;
  optionsByAgeGroup: Record<string, SessionOption[]>;
}
interface WeeklyRegistrationSession extends RegistrationSession {
  sessionIds: string[];
  days: number[];
  optionCount: number;
  options: SessionOption[];
}

type FieldValue = string | boolean | string[];
type Step = 1 | 2 | 3;

const PARENT_FIELD_IDS = new Set(["f5", "f6", "f7"]);
const STUDENT_FIELD_IDS = new Set(["f1", "f2", "f3", "f4"]);
const CONSENT_FIELD_IDS = new Set(["f8", "f9", "f10", "f11", "f12"]);
const SYSTEM_FIELD_IDS = new Set(["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12"]);

function isInputField(field: FormField) {
  return !["heading", "subheading", "divider", "pageBreak"].includes(field.type);
}

function ageMatches(course: Course, ageGroupId: string) {
  if (!ageGroupId) return false;
  return course.ageGroupId === ageGroupId || Boolean(course.courseAgeGroups?.some(ag => ag.ageGroupId === ageGroupId));
}

function weeklySessionKey(session: RegistrationSession) {
  return `${session.label || "Session"}|${session.startTime}|${session.endTime}|${session.mandatory ? "required" : "optional"}`;
}

function mergeWeeklyOptions(sessions: RegistrationSession[], ageGroupId: string): { optionCount: number; options: SessionOption[] } {
  if (!ageGroupId || sessions.length === 0) return { optionCount: 0, options: [] };
  const byCourse = new Map<string, SessionOption[]>();
  for (const session of sessions) {
    for (const option of session.optionsByAgeGroup?.[ageGroupId] || []) {
      const existing = byCourse.get(option.courseId) || [];
      existing.push(option);
      byCourse.set(option.courseId, existing);
    }
  }
  const options = Array.from(byCourse.values())
    .filter(matches => matches.length === sessions.length)
    .map(matches => ({
      ...matches[0],
      enrolledCount: Math.max(...matches.map(option => option.enrolledCount)),
      seatsLeft: matches.some(option => option.seatsLeft === null) ? null : Math.min(...matches.map(option => option.seatsLeft ?? 0)),
    }))
    .filter(option => option.seatsLeft === null || option.seatsLeft > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { optionCount: options.length, options };
}

function sessionLabel(session: WeeklyRegistrationSession) {
  return `${session.label || "Session"} · ${session.startTime}–${session.endTime}`;
}

function PublicRegistrationContent({ params }: { params: Promise<{ campId: string }> }) {
  const searchParams = useSearchParams();
  const [campId, setCampId]         = useState("");
  const [campName, setCampName]     = useState("");
  const [fields, setFields]         = useState<FormField[]>([]);
  const [ageGroups, setAgeGroups]   = useState<AgeGroup[]>([]);
  const [courses, setCourses]       = useState<Course[]>([]);
  const [registrationSessions, setRegistrationSessions] = useState<RegistrationSession[]>([]);
  const [classChoicesEnabled, setClassChoicesEnabled] = useState(true);
  const [formRef, setFormRef] = useState("");
  const [regOpen, setRegOpen]       = useState(false);
  const [billingMode, setBillingMode] = useState<"campPays" | "camperFee">("campPays");
  const [platformFeeCents, setPlatformFeeCents] = useState(300);
  const [paymentNotice, setPaymentNotice] = useState("");
  const [loading, setLoading]       = useState(true);
  const [values, setValues]         = useState<Record<string, FieldValue>>({});
  const [selectedBySession, setSelectedBySession] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [submittedUpdated, setSubmittedUpdated] = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [step, setStep]             = useState<Step>(1);
  const [duplicate, setDuplicate]   = useState<{ camperId: string; message: string } | null>(null);

  useEffect(() => {
    params.then(p => {
      setCampId(p.campId);
      const formRef = searchParams.get("form") || "";
      setFormRef(formRef);
      fetch(`/api/camps/${p.campId}/registration-form${formRef ? `?form=${encodeURIComponent(formRef)}` : ""}`)
        .then(r => r.json())
        .then(d => {
          setCampName(d.campName || "Camp");
          setRegOpen(d.registrationOpen || false);
          setBillingMode(d.billingMode === "camperFee" ? "camperFee" : "campPays");
          setPlatformFeeCents(Number(d.platformFeeCents || 300));
          setPaymentNotice(searchParams.get("payment") === "success" ? "Payment received — thank you!" : searchParams.get("payment") === "cancelled" ? "Payment was cancelled. You can submit another registration when ready." : "");
          setAgeGroups(Array.isArray(d.ageGroups) ? d.ageGroups : []);
          setCourses(Array.isArray(d.courses) ? d.courses : []);
          setRegistrationSessions(Array.isArray(d.registrationSessions) ? d.registrationSessions : []);
          setClassChoicesEnabled(d.form?.classChoicesEnabled !== false);
          try {
            const parsed = typeof d.fields === "string" ? JSON.parse(d.fields) : d.fields;
            setFields(Array.isArray(parsed) ? parsed : []);
          } catch { setFields([]); }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });
  }, [params, searchParams]);

  const setValue = (id: string, val: FieldValue) => {
    setValues(prev => {
      const next = { ...prev, [id]: val };
      if (id === "f4") setSelectedBySession({});
      return next;
    });
    if (errors[id]) setErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (errors._form) setErrors(prev => { const n = { ...prev }; delete n._form; return n; });
  };

  const toggleCheckboxOption = (id: string, option: string, checked: boolean) => {
    const current = Array.isArray(values[id]) ? values[id] as string[] : [];
    const next = checked ? [...new Set([...current, option])] : current.filter(v => v !== option);
    setValue(id, next);
  };

  const fieldsForStep = (targetStep: Step) => fields.filter(field => {
    if (!isInputField(field) && targetStep === 1) return true;
    if (targetStep === 1) return PARENT_FIELD_IDS.has(field.id) || STUDENT_FIELD_IDS.has(field.id);
    if (targetStep === 3) return CONSENT_FIELD_IDS.has(field.id) || (!field.system && isInputField(field));
    return false;
  });

  const selectedAgeGroupId = String(values.f4 || "");
  const selectedAgeGroup = ageGroups.find(ag => ag.id === selectedAgeGroupId);
  const selectableSessions: WeeklyRegistrationSession[] = !classChoicesEnabled || selectedAgeGroup?.noSchedule ? [] : Array.from(
    registrationSessions.reduce<Map<string, RegistrationSession[]>>((groups, session) => {
      const key = weeklySessionKey(session);
      const existing = groups.get(key) || [];
      existing.push(session);
      groups.set(key, existing);
      return groups;
    }, new Map()).values()
  ).map(sessions => {
    const sortedSessions = [...sessions].sort((a, b) => (a.dayOfWeek ?? 99) - (b.dayOfWeek ?? 99));
    const { optionCount, options } = mergeWeeklyOptions(sortedSessions, selectedAgeGroupId);
    return {
      ...sortedSessions[0],
      id: sortedSessions.map(session => session.id).join("|"),
      sessionIds: sortedSessions.map(session => session.id),
      days: sortedSessions.map(session => session.dayOfWeek).filter((day): day is number => typeof day === "number"),
      optionCount,
      options,
    };
  });
  const mandatoryWeeklySessions = selectableSessions.filter(session =>
    session.mandatory || Boolean(session.mandatorySessions?.some(ms => ms.ageGroupId === selectedAgeGroupId))
  );
  const requiredSessions = selectableSessions.filter(session =>
    !session.mandatory && !session.mandatorySessions?.some(ms => ms.ageGroupId === selectedAgeGroupId) && session.optionCount > 0
  );

  const validateStep = (targetStep: Step): boolean => {
    const errs: Record<string, string> = {};
    const targetFields = fieldsForStep(targetStep).filter(isInputField);
    for (const f of targetFields) {
      if (f.required) {
        const val = values[f.id];
        if (!val || (typeof val === "string" && !val.trim()) || (Array.isArray(val) && val.length === 0)) errs[f.id] = `${f.label} is required`;
      }
    }
    if (targetStep === 1) {
      for (const requiredId of ["f1", "f2", "f4", "f5", "f6"]) {
        if (fields.some(f => f.id === requiredId) && !values[requiredId]) errs[requiredId] = "Required";
      }
    }
    if (targetStep === 2 && classChoicesEnabled && !selectedAgeGroup?.noSchedule) {
      const unavailable = requiredSessions.filter(session => session.options.length === 0);
      const missing = requiredSessions.filter(session => session.options.length > 0 && !session.sessionIds.every(sessionId => selectedBySession[sessionId]));
      const selectedCoursesByWeeklySession = requiredSessions
        .map(session => session.sessionIds.map(sessionId => selectedBySession[sessionId]).find(Boolean))
        .filter((courseId): courseId is string => Boolean(courseId));
      const duplicateCourse = selectedCoursesByWeeklySession.find((courseId, index) => selectedCoursesByWeeklySession.indexOf(courseId) !== index);
      if (unavailable.length > 0) errs._form = "One or more sessions has no open classes left. Please contact the camp before registering.";
      else if (missing.length > 0) errs._form = "Please choose one class for each session.";
      else if (duplicateCourse) errs._form = "Each class can only be chosen once. Please pick a different class for one of the sessions.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (!validateStep(step)) return;
    setStep(prev => (prev === 1 ? (classChoicesEnabled ? 2 : 3) : 3));
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prevStep = () => {
    setStep(prev => (prev === 3 ? (classChoicesEnabled ? 2 : 1) : 1));
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectCourseForSession = (sessionIds: string[], courseId: string) => {
    setSelectedBySession(prev => ({
      ...prev,
      ...Object.fromEntries(sessionIds.map(sessionId => [sessionId, courseId])),
    }));
    if (errors._form) setErrors(prev => { const n = { ...prev }; delete n._form; return n; });
  };

  const selectedCourseIds = [...new Set(Object.values(selectedBySession).filter(Boolean))];
  const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

  const submitRegistration = async (updateExisting = false, existingCamperId?: string) => {
    setSubmitting(true);
    setDuplicate(null);
    try {
      const res = await fetch(`/api/camps/${campId}/public-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: values.f1 || "",
          lastName: values.f2 || "",
          dateOfBirth: values.f3 || undefined,
          ageGroupId: values.f4 || undefined,
          guardianName: values.f5 || "",
          guardianEmail: values.f6 || "",
          guardianPhone: values.f7 || "",
          emergencyPhone: values.f8 || undefined,
          tshirtSize: values.f9 || undefined,
          medicalNotes: values.f10 || undefined,
          dietaryNotes: values.f11 || undefined,
          photoConsent: Boolean(values.f12),
          selectedSessionCourseIds: classChoicesEnabled ? selectedBySession : {},
          selectedCourseIds: classChoicesEnabled ? selectedCourseIds : [],
          formRef,
          updateExisting,
          existingCamperId,
          customData: Object.fromEntries(fields.filter(f => !SYSTEM_FIELD_IDS.has(f.id) && isInputField(f)).map(f => [f.label, values[f.id] || ""])),
        }),
      });
      const d = await res.json();
      if (res.status === 409 && d.duplicate) {
        setDuplicate({ camperId: d.camperId, message: d.message });
        return;
      }
      if (!res.ok) {
        setErrors({ _form: d.error || "Submission failed. Please try again." });
        return;
      }
      if (d.checkoutUrl) {
        window.location.href = d.checkoutUrl;
        return;
      }
      if (d.paymentUnavailable) {
        setPaymentNotice("Registration saved. The payment system is not configured yet, so the camp will follow up about the platform fee.");
      }
      setSubmittedUpdated(Boolean(d.updated));
      setSubmitted(true);
    } catch {
      setErrors({ _form: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;
    await submitRegistration(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!regOpen) return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-sky-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        <span className="text-5xl mb-4 block">🔒</span>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">{campName}</h1>
        <p className="text-slate-500">Registration is not currently open. Check back later!</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-sky-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        <span className="text-6xl mb-4 block">🎉</span>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">{submittedUpdated ? "Registration updated!" : "You're registered!"}</h1>
        <p className="text-slate-500 mb-6">Your registration for <strong>{campName}</strong> has been {submittedUpdated ? "updated" : "submitted"}. Check your email for a confirmation copy.</p>
        <button onClick={() => { setSubmitted(false); setSubmittedUpdated(false); setValues({}); setSelectedBySession({}); setStep(1); }}
          className="px-5 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
          Register Another Camper
        </button>
      </div>
    </div>
  );

  const inputCls = (id: string) => `w-full px-4 py-2.5 border rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
    errors[id] ? "border-red-400 focus:ring-red-300" : "border-slate-200 focus:ring-forest-500/30 focus:border-forest-400"
  }`;

  const renderField = (field: FormField) => {
    if (field.type === "heading") return <div key={field.id} className="pt-2"><h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-2">{field.label}</h3></div>;
    if (field.type === "subheading") return (
      <div key={field.id} className="rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3">
        <p className="text-sm font-bold text-sky-900">{field.label}</p>
        {field.helpText && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-sky-800">{field.helpText}</p>}
      </div>
    );
    if (field.type === "pageBreak") return <div key={field.id} className="my-2 rounded-xl border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-bold text-amber-700">Continue on next page</div>;
    if (field.type === "divider") return <hr key={field.id} className="border-slate-100" />;
    return (
      <div key={field.id}>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {field.helpText && <p className="text-xs text-slate-400 mb-1.5">{field.helpText}</p>}
        {field.type === "textarea" ? (
          <textarea rows={3} placeholder={field.placeholder} value={(values[field.id] as string) || ""} onChange={e => setValue(field.id, e.target.value)} className={inputCls(field.id) + " resize-none"} />
        ) : field.type === "checkbox" ? (
          field.options?.length ? (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              {field.options.map(option => (
                <label key={option} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Array.isArray(values[field.id]) && (values[field.id] as string[]).includes(option)}
                    onChange={e => toggleCheckboxOption(field.id, option, e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-forest-500"
                  />
                  <span className="text-sm text-slate-700">{option}</span>
                </label>
              ))}
            </div>
          ) : (
            <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <input type="checkbox" checked={Boolean(values[field.id])} onChange={e => setValue(field.id, e.target.checked)} className="w-4 h-4 mt-0.5 accent-forest-500" />
              <span className="text-sm text-slate-700">{field.checkboxDescription || field.label}</span>
            </label>
          )
        ) : field.type === "select" ? (
          <select value={(values[field.id] as string) || ""} onChange={e => setValue(field.id, e.target.value)} className={inputCls(field.id)}>
            <option value="">— select —</option>
            {field.source === "ageGroups" ? ageGroups.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>) : field.options?.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input type={field.type} placeholder={field.placeholder} value={(values[field.id] as string) || ""} onChange={e => setValue(field.id, e.target.value)} className={inputCls(field.id)} />
        )}
        {errors[field.id] && <p className="text-xs text-red-500 mt-1">{errors[field.id]}</p>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-sky-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-forest-500 to-sky-500 flex items-center justify-center text-white text-3xl mx-auto mb-4 shadow-lg">🏕️</div>
          <h1 className="text-3xl font-bold text-slate-800">{campName}</h1>
          <p className="text-slate-500 mt-1">Camper Registration</p>
        </div>

        <div className="flex items-center gap-2 mb-5">
          {(classChoicesEnabled ? ["Info", "Classes", "Consent"] : ["Info", "Consent"]).map((label, idx) => {
            const num = classChoicesEnabled ? idx + 1 : (idx === 0 ? 1 : 3);
            const active = step === num;
            const done = step > num;
            return <div key={label} className={`flex-1 rounded-full px-3 py-2 text-center text-xs font-bold ${active ? "bg-forest-600 text-white" : done ? "bg-forest-100 text-forest-700" : "bg-white text-slate-400 border border-slate-200"}`}>{done ? "✓ " : ""}{label}</div>;
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {paymentNotice && <div className="mb-5 px-4 py-3 bg-forest-50 border border-forest-200 rounded-xl text-sm text-forest-800">{paymentNotice}</div>}
          {billingMode === "camperFee" && (
            <div className="mb-5 px-4 py-3 bg-sky-50 border border-sky-200 rounded-xl text-sm text-sky-900">
              A {money(platformFeeCents)} platform fee is collected after registration to help keep camp software costs off the camp budget.
            </div>
          )}
          {errors._form && <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{errors._form}</div>}
          {duplicate && (
            <div className="mb-5 px-4 py-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm font-semibold text-amber-900 mb-1">Possible duplicate registration</p>
              <p className="text-sm text-amber-800 mb-3">{duplicate.message}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={submitting} onClick={() => submitRegistration(true, duplicate.camperId)} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-60">Update Original Submission</button>
                <button type="button" onClick={() => setDuplicate(null)} className="px-4 py-2 bg-white border border-amber-200 text-amber-800 rounded-lg text-sm font-semibold hover:bg-amber-100">Go Back & Edit</button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {step === 1 && (
              <>
                <h2 className="text-xl font-bold text-slate-800">Parent + student info</h2>
                <p className="text-sm text-slate-500">Age Group is required for registration. {classChoicesEnabled ? "The next step will show classroom choices based on the selected age group." : "Class choices are disabled for this form, so families will continue directly to consent."}</p>
                {fieldsForStep(1).map(renderField)}
                <button type="button" onClick={nextStep} className="w-full py-3.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-bold hover:opacity-90">{classChoicesEnabled ? "Continue to Classes →" : "Continue →"}</button>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-xl font-bold text-slate-800">Choose classes by session</h2>
                <p className="text-sm text-slate-500">Pick one class for each session. Full classes are hidden automatically; if seats are added later, they reappear here.</p>
                {selectedAgeGroup?.noSchedule ? (
                  <div className="px-4 py-6 bg-amber-50 border border-amber-200 rounded-xl text-center text-sm text-amber-700">This age group is marked “No Schedule,” so no class choices are required.</div>
                ) : registrationSessions.length === 0 ? (
                  <div className="px-4 py-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm text-slate-500">No class sessions are currently available.</div>
                ) : (
                  <div className="space-y-5">
                    {mandatoryWeeklySessions.length > 0 && (
                      <div className="rounded-2xl border border-forest-200 bg-forest-50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-forest-100">
                          <p className="font-bold text-forest-800 text-sm">🔒 Included automatically</p>
                          <p className="text-xs text-forest-700">These required assemblies are assigned to this age group and are not parent choices.</p>
                        </div>
                        <div className="divide-y divide-forest-100">
                          {mandatoryWeeklySessions.map(session => {
                            const block = session.mandatorySessions?.find(ms => ms.ageGroupId === selectedAgeGroupId);
                            return <div key={session.id} className="px-4 py-3 text-sm text-forest-900">
                              <p className="font-semibold">{block?.title || session.label || "Required session"} · {session.startTime}–{session.endTime}</p>
                              <p className="text-xs text-forest-700 mt-0.5">
                                {block?.room?.name ? `Location: ${block.room.name}` : "Location assigned by camp"}
                                {block?.leader ? ` · Leader: ${block.leader.firstName} ${block.leader.lastName}` : ""}
                              </p>
                            </div>;
                          })}
                        </div>
                      </div>
                    )}

                    {requiredSessions.length === 0 ? (
                      <div className="px-4 py-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm text-slate-500">No class choices are required for this age group.</div>
                    ) : requiredSessions.map(session => (
                      <div key={session.id} className="rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                          <p className="font-bold text-slate-800 text-sm">{sessionLabel(session)}</p>
                          <p className="text-xs text-slate-500">Choose one class for this session.</p>
                        </div>
                        {session.options.length === 0 ? (
                          <div className="px-4 py-5 text-sm text-amber-700 bg-amber-50">No open seats remain for this session.</div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {session.options.map(option => {
                              const checked = session.sessionIds.every(sessionId => selectedBySession[sessionId] === option.courseId);
                              const selectedInAnotherSession = Object.entries(selectedBySession).some(([sessionId, courseId]) => !session.sessionIds.includes(sessionId) && courseId === option.courseId);
                              const unavailableBecauseChosen = selectedInAnotherSession && !checked;
                              return <label key={option.courseId} className={`block p-4 transition-all ${unavailableBecauseChosen ? "bg-slate-50 opacity-50 cursor-not-allowed" : checked ? "bg-forest-50 cursor-pointer" : "hover:bg-slate-50 cursor-pointer"}`}>
                                <div className="flex items-start gap-3">
                                  <input type="radio" name={`session-${session.id}`} checked={checked} disabled={unavailableBecauseChosen} onChange={() => selectCourseForSession(session.sessionIds, option.courseId)} className="mt-1 w-4 h-4 accent-forest-500 disabled:accent-slate-300" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                      <p className="font-semibold text-slate-800">{option.name}</p>
                                      <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${unavailableBecauseChosen ? "text-slate-500 bg-slate-200" : "text-forest-700 bg-forest-100"}`}>
                                        {unavailableBecauseChosen ? "Already chosen" : option.seatsLeft === null ? "Open seats" : `${option.seatsLeft} seats left`}
                                      </span>
                                    </div>
                                    {option.description && <p className="text-sm text-slate-500 mt-0.5">{option.description}</p>}
                                  </div>
                                </div>
                              </label>;
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={prevStep} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">← Back</button>
                  <button type="button" onClick={nextStep} className="flex-1 py-3 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-bold hover:opacity-90">Continue →</button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="text-xl font-bold text-slate-800">Consent + emergency info</h2>
                {fieldsForStep(3).map(renderField)}
                <div className="flex gap-3">
                  <button type="button" onClick={prevStep} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">← Back</button>
                  <button type="submit" disabled={submitting} className="flex-1 py-3 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                    {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</> : billingMode === "camperFee" ? `Submit + Pay ${money(platformFeeCents)} →` : "Submit Registration →"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default function PublicRegistrationPage({ params }: { params: Promise<{ campId: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-10 h-10 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <PublicRegistrationContent params={params} />
    </Suspense>
  );
}
