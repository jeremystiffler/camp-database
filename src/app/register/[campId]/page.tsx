"use client";

import { useState, useEffect } from "react";

interface FormField {
  id: string;
  type: "text" | "email" | "tel" | "date" | "select" | "textarea" | "checkbox" | "heading" | "divider";
  label: string;
  required: boolean;
  system?: boolean;
  options?: string[];
  source?: string;
  placeholder?: string;
  helpText?: string;
}

interface AgeGroup { id: string; name: string; }
interface Course {
  id: string;
  name: string;
  description?: string | null;
  cap?: number | null;
  ageGroupId?: string | null;
  courseAgeGroups?: { ageGroupId: string }[];
}

type FieldValue = string | boolean;
type Step = 1 | 2 | 3;

const PARENT_FIELD_IDS = new Set(["f5", "f6", "f7"]);
const STUDENT_FIELD_IDS = new Set(["f1", "f2", "f3", "f4"]);
const CONSENT_FIELD_IDS = new Set(["f8", "f9", "f10", "f11", "f12"]);
const SYSTEM_FIELD_IDS = new Set(["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12"]);

function isInputField(field: FormField) {
  return field.type !== "heading" && field.type !== "divider";
}

function ageMatches(course: Course, ageGroupId: string) {
  if (!ageGroupId) return false;
  return course.ageGroupId === ageGroupId || Boolean(course.courseAgeGroups?.some(ag => ag.ageGroupId === ageGroupId));
}

export default function PublicRegistrationPage({ params }: { params: Promise<{ campId: string }> }) {
  const [campId, setCampId]         = useState("");
  const [campName, setCampName]     = useState("");
  const [fields, setFields]         = useState<FormField[]>([]);
  const [ageGroups, setAgeGroups]   = useState<AgeGroup[]>([]);
  const [courses, setCourses]       = useState<Course[]>([]);
  const [regOpen, setRegOpen]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [values, setValues]         = useState<Record<string, FieldValue>>({});
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [submittedUpdated, setSubmittedUpdated] = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [step, setStep]             = useState<Step>(1);
  const [duplicate, setDuplicate]   = useState<{ camperId: string; message: string } | null>(null);

  useEffect(() => {
    params.then(p => {
      setCampId(p.campId);
      fetch(`/api/camps/${p.campId}/registration-form`)
        .then(r => r.json())
        .then(d => {
          setCampName(d.campName || "Camp");
          setRegOpen(d.registrationOpen || false);
          setAgeGroups(Array.isArray(d.ageGroups) ? d.ageGroups : []);
          setCourses(Array.isArray(d.courses) ? d.courses : []);
          try {
            const parsed = typeof d.fields === "string" ? JSON.parse(d.fields) : d.fields;
            setFields(Array.isArray(parsed) ? parsed : []);
          } catch { setFields([]); }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });
  }, [params]);

  const setValue = (id: string, val: FieldValue) => {
    setValues(prev => {
      const next = { ...prev, [id]: val };
      if (id === "f4") setSelectedCourseIds([]);
      return next;
    });
    if (errors[id]) setErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (errors._form) setErrors(prev => { const n = { ...prev }; delete n._form; return n; });
  };

  const fieldsForStep = (targetStep: Step) => fields.filter(field => {
    if (!isInputField(field) && targetStep === 1) return true;
    if (targetStep === 1) return PARENT_FIELD_IDS.has(field.id) || STUDENT_FIELD_IDS.has(field.id);
    if (targetStep === 3) return CONSENT_FIELD_IDS.has(field.id) || (!field.system && isInputField(field));
    return false;
  });

  const validateStep = (targetStep: Step): boolean => {
    const errs: Record<string, string> = {};
    const targetFields = fieldsForStep(targetStep).filter(isInputField);
    for (const f of targetFields) {
      if (f.required) {
        const val = values[f.id];
        if (!val || (typeof val === "string" && !val.trim())) errs[f.id] = `${f.label} is required`;
      }
    }
    if (targetStep === 1) {
      for (const requiredId of ["f1", "f2", "f4", "f5", "f6"]) {
        if (fields.some(f => f.id === requiredId) && !values[requiredId]) errs[requiredId] = "Required";
      }
    }
    if (targetStep === 2 && selectedCourseIds.length === 0) errs._form = "Please choose at least one class.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (!validateStep(step)) return;
    setStep(prev => (prev === 1 ? 2 : 3));
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prevStep = () => {
    setStep(prev => (prev === 3 ? 2 : 1));
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const availableCourses = courses.filter(course => ageMatches(course, String(values.f4 || "")));

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds(prev => prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]);
    if (errors._form) setErrors(prev => { const n = { ...prev }; delete n._form; return n; });
  };

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
          selectedCourseIds,
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
        <button onClick={() => { setSubmitted(false); setSubmittedUpdated(false); setValues({}); setSelectedCourseIds([]); setStep(1); }}
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
    if (field.type === "divider") return <hr key={field.id} className="border-slate-100" />;
    return (
      <div key={field.id}>
        {field.type !== "checkbox" && (
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
        )}
        {field.helpText && <p className="text-xs text-slate-400 mb-1.5">{field.helpText}</p>}
        {field.type === "textarea" ? (
          <textarea rows={3} placeholder={field.placeholder} value={(values[field.id] as string) || ""} onChange={e => setValue(field.id, e.target.value)} className={inputCls(field.id) + " resize-none"} />
        ) : field.type === "checkbox" ? (
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={Boolean(values[field.id])} onChange={e => setValue(field.id, e.target.checked)} className="w-4 h-4 mt-0.5 accent-forest-500" />
            <span className="text-sm text-slate-700">{field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}</span>
          </label>
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
          {["Info", "Classes", "Consent"].map((label, idx) => {
            const num = idx + 1;
            const active = step === num;
            const done = step > num;
            return <div key={label} className={`flex-1 rounded-full px-3 py-2 text-center text-xs font-bold ${active ? "bg-forest-600 text-white" : done ? "bg-forest-100 text-forest-700" : "bg-white text-slate-400 border border-slate-200"}`}>{done ? "✓ " : ""}{label}</div>;
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
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
                <p className="text-sm text-slate-500">Choose an age group here; the next step will only show classes for that group.</p>
                {fieldsForStep(1).map(renderField)}
                <button type="button" onClick={nextStep} className="w-full py-3.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-bold hover:opacity-90">Continue to Classes →</button>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-xl font-bold text-slate-800">Choose classes</h2>
                <p className="text-sm text-slate-500">Only classes available for the selected age group are shown. A class can only be selected once.</p>
                {availableCourses.length === 0 ? (
                  <div className="px-4 py-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm text-slate-500">No classes are currently available for this age group.</div>
                ) : (
                  <div className="space-y-3">
                    {availableCourses.map(course => {
                      const checked = selectedCourseIds.includes(course.id);
                      return <label key={course.id} className={`block p-4 rounded-xl border cursor-pointer transition-all ${checked ? "border-forest-400 bg-forest-50" : "border-slate-200 hover:border-forest-200"}`}>
                        <div className="flex items-start gap-3">
                          <input type="checkbox" checked={checked} onChange={() => toggleCourse(course.id)} className="mt-1 w-4 h-4 accent-forest-500" />
                          <div>
                            <p className="font-semibold text-slate-800">{course.name}</p>
                            {course.description && <p className="text-sm text-slate-500 mt-0.5">{course.description}</p>}
                          </div>
                        </div>
                      </label>;
                    })}
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
                    {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</> : "Submit Registration →"}
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
