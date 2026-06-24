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

export default function PublicRegistrationPage({ params }: { params: Promise<{ campId: string }> }) {
  const [campId, setCampId]         = useState("");
  const [campName, setCampName]     = useState("");
  const [fields, setFields]         = useState<FormField[]>([]);
  const [ageGroups, setAgeGroups]   = useState<AgeGroup[]>([]);
  const [regOpen, setRegOpen]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [values, setValues]         = useState<Record<string, string | boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  useEffect(() => {
    params.then(p => {
      setCampId(p.campId);
      fetch(`/api/camps/${p.campId}/registration-form`)
        .then(r => r.json())
        .then(d => {
          setCampName(d.campName || "Camp");
          setRegOpen(d.registrationOpen || false);
          setAgeGroups(Array.isArray(d.ageGroups) ? d.ageGroups : []);
          try {
            const parsed = typeof d.fields === "string" ? JSON.parse(d.fields) : d.fields;
            setFields(Array.isArray(parsed) ? parsed : []);
          } catch { setFields([]); }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });
  }, [params]);

  const setValue = (id: string, val: string | boolean) => {
    setValues(prev => ({ ...prev, [id]: val }));
    if (errors[id]) setErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && f.type !== "heading" && f.type !== "divider") {
        const val = values[f.id];
        if (!val || (typeof val === "string" && !val.trim())) {
          errs[f.id] = `${f.label} is required`;
        }
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) { document.querySelector(".border-red-400")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/camps/${campId}/campers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName:     values["f1"] || "",
          lastName:      values["f2"] || "",
          dateOfBirth:   values["f3"] ? new Date(values["f3"] as string).toISOString() : undefined,
          ageGroupId:    values["f4"] || undefined,
          guardianName:  values["f5"] || "",
          guardianEmail: values["f6"] || "",
          guardianPhone: values["f7"] || "",
          emergencyPhone:values["f8"] || undefined,
          tshirtSize:    values["f9"] || undefined,
          medicalNotes:  values["f10"] || undefined,
          dietaryNotes:  values["f11"] || undefined,
          photoConsent:  Boolean(values["f12"]),
          customData: JSON.stringify(
            Object.fromEntries(
              fields
                .filter(f => !f.system && f.type !== "heading" && f.type !== "divider")
                .map(f => [f.label, values[f.id] || ""])
            )
          ),
        }),
      });
      if (res.ok) { setSubmitted(true); }
      else {
        const d = await res.json();
        setErrors({ _form: d.error || "Submission failed. Please try again." });
      }
    } catch { setErrors({ _form: "Network error. Please try again." }); }
    finally { setSubmitting(false); }
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
        <h1 className="text-2xl font-bold text-slate-800 mb-2">You&apos;re registered!</h1>
        <p className="text-slate-500 mb-6">Your registration for <strong>{campName}</strong> has been submitted successfully. You&apos;ll receive a confirmation email soon.</p>
        <button onClick={() => { setSubmitted(false); setValues({}); }}
          className="px-5 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
          Register Another Camper
        </button>
      </div>
    </div>
  );

  const inputCls = (id: string) => `w-full px-4 py-2.5 border rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
    errors[id] ? "border-red-400 focus:ring-red-300" : "border-slate-200 focus:ring-forest-500/30 focus:border-forest-400"
  }`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-sky-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-forest-500 to-sky-500 flex items-center justify-center text-white text-3xl mx-auto mb-4 shadow-lg">🏕️</div>
          <h1 className="text-3xl font-bold text-slate-800">{campName}</h1>
          <p className="text-slate-500 mt-1">Camper Registration</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {errors._form && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{errors._form}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {fields.map(field => {
              if (field.type === "heading") return (
                <div key={field.id} className="pt-2">
                  <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-2">{field.label}</h3>
                </div>
              );
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
                    <textarea rows={3} placeholder={field.placeholder}
                      value={(values[field.id] as string) || ""}
                      onChange={e => setValue(field.id, e.target.value)}
                      className={inputCls(field.id) + " resize-none"} />
                  ) : field.type === "checkbox" ? (
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox"
                        checked={Boolean(values[field.id])}
                        onChange={e => setValue(field.id, e.target.checked)}
                        className="w-4 h-4 mt-0.5 accent-forest-500" />
                      <span className="text-sm text-slate-700">{field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}</span>
                    </label>
                  ) : field.type === "select" ? (
                    <select
                      value={(values[field.id] as string) || ""}
                      onChange={e => setValue(field.id, e.target.value)}
                      className={inputCls(field.id)}>
                      <option value="">— select —</option>
                      {field.source === "ageGroups"
                        ? ageGroups.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)
                        : field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={(values[field.id] as string) || ""}
                      onChange={e => setValue(field.id, e.target.value)}
                      className={inputCls(field.id)} />
                  )}
                  {errors[field.id] && <p className="text-xs text-red-500 mt-1">{errors[field.id]}</p>}
                </div>
              );
            })}

            <button type="submit" disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
              {submitting
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</>
                : "Submit Registration →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
