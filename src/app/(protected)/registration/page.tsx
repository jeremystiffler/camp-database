"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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

interface FormSummary {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "public" | "linkOnly";
  isDefault: boolean;
  classChoicesEnabled?: boolean;
}

const FIELD_ICONS: Record<string, string> = {
  text: "Aa", email: "@", tel: "📞", date: "📅", number: "#", url: "🔗", select: "▾", textarea: "¶", checkbox: "☑", heading: "H", subheading: "ℹ", divider: "—", pageBreak: "↧",
};

type AddFieldCategory = "Basic" | "Contact" | "Choice" | "Camp" | "Consent" | "Layout";
type AddFieldItem = {
  type: FormField["type"];
  label: string;
  icon: string;
  category: AddFieldCategory;
  description?: string;
  defaults?: Partial<Omit<FormField, "id" | "type">>;
};

const ADD_FIELD_TYPES: AddFieldItem[] = [
  { category: "Layout", type: "heading",  label: "Section heading", icon: "H", description: "Bold section title", defaults: { label: "New section" } },
  { category: "Layout", type: "subheading", label: "Info / instructions", icon: "ℹ", description: "Instruction card", defaults: { label: "Important information", helpText: "Add multi-line details families should read before continuing." } },
  { category: "Layout", type: "divider",  label: "Divider", icon: "—", description: "Visual separator" },
  { category: "Layout", type: "pageBreak", label: "Page break", icon: "↧", description: "Split the form into pages", defaults: { label: "Page break" } },

  { category: "Basic", type: "text", label: "Short text", icon: "Aa", description: "Single-line answer", defaults: { label: "Short answer", placeholder: "Type your answer" } },
  { category: "Basic", type: "textarea", label: "Long text", icon: "¶", description: "Paragraph answer", defaults: { label: "Long answer", placeholder: "Type details here" } },
  { category: "Basic", type: "number", label: "Number", icon: "#", description: "Numeric answer", defaults: { label: "Number", placeholder: "0" } },
  { category: "Basic", type: "date", label: "Date picker", icon: "📅", description: "Calendar date", defaults: { label: "Date" } },
  { category: "Basic", type: "url", label: "Website / link", icon: "🔗", description: "URL field", defaults: { label: "Website", placeholder: "https://" } },

  { category: "Contact", type: "text", label: "Full name", icon: "👤", description: "Person name", defaults: { label: "Full name", placeholder: "First and last name" } },
  { category: "Contact", type: "email", label: "Email", icon: "@", description: "Email address", defaults: { label: "Email", placeholder: "name@example.com" } },
  { category: "Contact", type: "tel", label: "Phone", icon: "📞", description: "Phone number", defaults: { label: "Phone", placeholder: "(555) 555-5555" } },
  { category: "Contact", type: "textarea", label: "Address", icon: "🏠", description: "Mailing address", defaults: { label: "Address", placeholder: "Street, city, state, ZIP" } },

  { category: "Choice", type: "select", label: "Dropdown", icon: "▾", description: "Choose one from a menu", defaults: { label: "Dropdown", options: ["Option 1", "Option 2", "Option 3"] } },
  { category: "Choice", type: "checkbox", label: "Single checkbox", icon: "☑", description: "One acknowledgement", defaults: { label: "Agreement", checkboxDescription: "I agree to this statement." } },
  { category: "Choice", type: "checkbox", label: "Multiple checkboxes", icon: "☑☑", description: "Select all that apply", defaults: { label: "Select all that apply", options: ["Option 1", "Option 2", "Option 3"] } },
  { category: "Choice", type: "select", label: "Yes / No", icon: "Y/N", description: "Simple yes/no choice", defaults: { label: "Yes or no?", options: ["Yes", "No"] } },

  { category: "Camp", type: "text", label: "Preferred name", icon: "🏷️", description: "Camper nickname", defaults: { label: "Preferred name", placeholder: "What should we call your camper?" } },
  { category: "Camp", type: "text", label: "Grade / school", icon: "🎒", description: "Grade and school", defaults: { label: "Grade entering / school", placeholder: "Example: 4th grade, Liberty Elementary" } },
  { category: "Camp", type: "select", label: "T-shirt size", icon: "👕", description: "Common shirt sizes", defaults: { label: "T-shirt size", options: ["Youth XS", "Youth S", "Youth M", "Youth L", "Youth XL", "Adult S", "Adult M", "Adult L", "Adult XL", "Adult 2XL"] } },
  { category: "Camp", type: "textarea", label: "Allergies", icon: "⚕️", description: "Health safety", defaults: { label: "Allergies", placeholder: "Food, medication, insect, or environmental allergies" } },
  { category: "Camp", type: "textarea", label: "Medications", icon: "💊", description: "Medication details", defaults: { label: "Medications", placeholder: "Medication name, dosage, schedule, and instructions" } },
  { category: "Camp", type: "textarea", label: "Dietary needs", icon: "🥪", description: "Meal restrictions", defaults: { label: "Dietary restrictions or meal notes", placeholder: "Vegetarian, gluten-free, no pork, etc." } },
  { category: "Camp", type: "textarea", label: "Accommodations", icon: "🤝", description: "Learning/access needs", defaults: { label: "Learning, behavioral, sensory, or accessibility needs", placeholder: "Anything that helps us serve your camper well" } },
  { category: "Camp", type: "text", label: "Authorized pickup", icon: "🚗", description: "Approved adults", defaults: { label: "Authorized pickup people", placeholder: "Names of adults allowed to pick up this camper" } },
  { category: "Camp", type: "text", label: "Not authorized pickup", icon: "🚫", description: "Restricted pickup", defaults: { label: "People not authorized for pickup", placeholder: "Optional" } },
  { category: "Camp", type: "tel", label: "Emergency backup phone", icon: "☎️", description: "Backup contact", defaults: { label: "Backup emergency phone", placeholder: "If guardian cannot be reached" } },
  { category: "Camp", type: "text", label: "Physician / clinic", icon: "🩺", description: "Medical contact", defaults: { label: "Physician or clinic", placeholder: "Doctor/clinic name and phone" } },
  { category: "Camp", type: "text", label: "Insurance info", icon: "🛡️", description: "Policy details", defaults: { label: "Insurance provider / policy", placeholder: "Optional, if your camp collects it" } },

  { category: "Consent", type: "checkbox", label: "Transportation permission", icon: "🚌", description: "Travel consent", defaults: { label: "Transportation permission", checkboxDescription: "I give permission for camp-provided transportation when applicable." } },
  { category: "Consent", type: "checkbox", label: "Medical consent", icon: "✅", description: "Emergency care", defaults: { label: "Medical consent", checkboxDescription: "I authorize camp staff to seek emergency medical care if needed.", required: true } },
  { category: "Consent", type: "checkbox", label: "Code of conduct", icon: "🤝", description: "Behavior agreement", defaults: { label: "Code of conduct", checkboxDescription: "I have reviewed the camp expectations with my camper and agree to support them.", required: true } },
];

const ADD_FIELD_CATEGORIES: AddFieldCategory[] = ["Basic", "Contact", "Choice", "Camp", "Consent", "Layout"];

const LAYOUT_FIELD_TYPES = new Set<FormField["type"]>(["heading", "subheading", "divider", "pageBreak"]);
const isLayoutField = (field: FormField) => LAYOUT_FIELD_TYPES.has(field.type);

function FieldPreview({ field, ageGroups }: { field: FormField; ageGroups: { id: string; name: string }[] }) {
  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none";
  if (field.type === "heading") return <h3 className="font-bold text-slate-800 text-base mt-2">{field.label}</h3>;
  if (field.type === "subheading") return (
    <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3">
      <p className="text-sm font-bold text-sky-900">{field.label}</p>
      {field.helpText && <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-sky-800">{field.helpText}</p>}
    </div>
  );
  if (field.type === "pageBreak") return <div className="my-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs font-bold text-amber-700">Page break</div>;
  if (field.type === "divider") return <hr className="border-slate-200 my-2" />;
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {field.helpText && <p className="text-xs text-slate-400 mb-1">{field.helpText}</p>}
      {field.type === "textarea" ? (
        <textarea rows={2} placeholder={field.placeholder || ""} disabled className={inputCls + " resize-none"} />
      ) : field.type === "checkbox" ? (
        <div className="space-y-2">
          {(field.options?.length ? field.options : [field.checkboxDescription || field.label]).map(option => (
            <label key={option} className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" disabled className="mt-0.5 w-4 h-4" /> <span>{option}</span>
            </label>
          ))}
        </div>
      ) : field.type === "select" ? (
        <select disabled className={inputCls}>
          <option>— select —</option>
          {field.source === "ageGroups"
            ? ageGroups.map(ag => <option key={ag.id}>{ag.name}</option>)
            : field.options?.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={field.type} placeholder={field.placeholder || ""} disabled className={inputCls} />
      )}
    </div>
  );
}

function FieldEditor({ field, onChange }: { field: FormField; onChange: (f: FormField) => void }) {
  return (
    <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">{field.type === "checkbox" ? "Checkbox title" : "Label"}</label>
          <input value={field.label} onChange={e => onChange({ ...field, label: e.target.value })}
            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-forest-400" />
        </div>
        {field.type !== "checkbox" && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Placeholder</label>
            <input value={field.placeholder || ""} onChange={e => onChange({ ...field, placeholder: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-forest-400" />
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">{field.type === "subheading" ? "Multi-line information" : "Help text"}</label>
        <textarea rows={field.type === "subheading" ? 4 : 2} value={field.helpText || ""} onChange={e => onChange({ ...field, helpText: e.target.value })}
          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-forest-400 resize-none" />
      </div>
      {field.type === "checkbox" && (
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Single checkbox description</label>
            <input value={field.checkboxDescription || ""} onChange={e => onChange({ ...field, checkboxDescription: e.target.value })}
              placeholder="Text shown beside the checkbox"
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-forest-400" />
            <p className="mt-1 text-[11px] text-slate-400">Used when the options box below is empty.</p>
          </div>
        </div>
      )}
      {(field.type === "select" || field.type === "checkbox") && !field.source && (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">{field.type === "checkbox" ? "Multiple checkbox choices (one per line)" : "Options (one per line)"}</label>
          <textarea rows={3}
            value={field.options?.join("\n") || ""}
            onChange={e => onChange({ ...field, options: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-forest-400 resize-none" />
        </div>
      )}
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={field.required} onChange={e => onChange({ ...field, required: e.target.checked })} className="w-3.5 h-3.5" />
        Required field
      </label>
    </div>
  );
}

function RegistrationContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";

  const [fields, setFields]         = useState<FormField[]>([]);
  const [forms, setForms]           = useState<FormSummary[]>([]);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [formTitle, setFormTitle]   = useState("Registration Form");
  const [formSlug, setFormSlug]     = useState("main");
  const [formStatus, setFormStatus] = useState<FormSummary["status"]>("public");
  const [isDefault, setIsDefault]   = useState(true);
  const [classChoicesEnabled, setClassChoicesEnabled] = useState(true);
  const [ageGroups, setAgeGroups]   = useState<{ id: string; name: string }[]>([]);
  const [campName, setCampName]     = useState("");
  const [regOpen, setRegOpen]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const dragIdx = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  const applyFormResponse = (d: { campName?: string; registrationOpen?: boolean; ageGroups?: { id: string; name: string }[]; forms?: FormSummary[]; form?: FormSummary | null; fields?: unknown }) => {
    setCampName(d.campName || "");
    setRegOpen(d.registrationOpen || false);
    setAgeGroups(Array.isArray(d.ageGroups) ? d.ageGroups : []);
    setForms(Array.isArray(d.forms) ? d.forms : []);
    if (d.form) {
      setSelectedFormId(d.form.id);
      setFormTitle(d.form.title || "Registration Form");
      setFormSlug(d.form.slug || d.form.id);
      setFormStatus(d.form.status || "public");
      setIsDefault(Boolean(d.form.isDefault));
      setClassChoicesEnabled(d.form.classChoicesEnabled !== false);
    }
    try { setFields(JSON.parse(typeof d.fields === "string" ? d.fields : JSON.stringify(d.fields))); } catch { setFields([]); }
  };

  const loadForm = (formRef?: string) => {
    if (!campId) return;
    setLoading(true);
    fetch(`/api/camps/${campId}/registration-form${formRef ? `?form=${encodeURIComponent(formRef)}` : ""}`)
      .then(r => r.json())
      .then(d => {
        applyFormResponse(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadForm();
  }, [campId]);

  const refreshForms = async (formRef?: string) => {
    const r = await fetch(`/api/camps/${campId}/registration-form${formRef ? `?form=${encodeURIComponent(formRef)}` : ""}`);
    const d = await r.json();
    applyFormResponse(d);
  };

  const save = async () => {
    setSaving(true); setSaved(false);
    const res = await fetch(`/api/camps/${campId}/registration-form`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formId: selectedFormId, title: formTitle, slug: formSlug, status: formStatus, isDefault, classChoicesEnabled, fields }),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.form) {
        setSelectedFormId(d.form.id);
        setFormTitle(d.form.title);
        setFormSlug(d.form.slug);
        setFormStatus(d.form.status);
        setIsDefault(d.form.isDefault);
        setClassChoicesEnabled(d.form.classChoicesEnabled !== false);
      }
      await refreshForms(d.form?.id || selectedFormId);
    }
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const createForm = async () => {
    const name = window.prompt("Name this registration form", "New Registration Form");
    if (!name) return;
    const res = await fetch(`/api/camps/${campId}/registration-form`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: name }),
    });
    if (res.ok) {
      const d = await res.json();
      await refreshForms(d.form?.id);
    }
  };

  const addField = (item: AddFieldItem) => {
    const newField: FormField = {
      id: `custom_${Date.now()}`,
      type: item.type,
      label: item.defaults?.label || item.label,
      required: Boolean(item.defaults?.required),
      placeholder: item.defaults?.placeholder,
      helpText: item.defaults?.helpText,
      checkboxDescription: item.defaults?.checkboxDescription,
      options: item.defaults?.options,
      source: item.defaults?.source,
      system: item.defaults?.system,
    };
    setFields(prev => [...prev, newField]);
    setEditingId(isLayoutField(newField) && newField.type !== "heading" && newField.type !== "subheading" ? null : newField.id);
    if (newField.type === "pageBreak") setPreviewPage(previewPages.length);
    setShowAddMenu(false);
  };

  const updateField = (id: string, updated: FormField) => setFields(prev => prev.map(f => f.id === id ? updated : f));
  const removeField = (id: string) => setFields(prev => prev.filter(f => f.id !== id));

  const onDragStart = (i: number) => { dragIdx.current = i; };
  const onDragOver  = (e: React.DragEvent, i: number) => { e.preventDefault(); dragOverIdx.current = i; };
  const onDrop      = () => {
    if (dragIdx.current === null || dragOverIdx.current === null) return;
    const arr = [...fields];
    const [moved] = arr.splice(dragIdx.current, 1);
    arr.splice(dragOverIdx.current, 0, moved);
    setFields(arr);
    dragIdx.current = null; dragOverIdx.current = null;
  };

  const previewPages = fields.reduce<FormField[][]>((pages, field) => {
    if (field.type === "pageBreak") {
      pages.push([]);
      return pages;
    }
    pages[pages.length - 1].push(field);
    return pages;
  }, [[]]);
  const currentPreviewPage = Math.min(previewPage, Math.max(previewPages.length - 1, 0));
  const ageGroupField = fields.find(field => field.id === "f4" || field.source === "ageGroups");
  const ageGroupReady = Boolean(ageGroupField?.required);

  useEffect(() => {
    if (previewPage > Math.max(previewPages.length - 1, 0)) setPreviewPage(Math.max(previewPages.length - 1, 0));
  }, [previewPage, previewPages.length]);

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/register/${campId}${formSlug ? `?form=${encodeURIComponent(formSlug)}` : ""}`
    : `/register/${campId}${formSlug ? `?form=${encodeURIComponent(formSlug)}` : ""}`;

  if (!campId) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center"><span className="text-4xl mb-3 block">📋</span><p>Select a camp to manage its registration form.</p></div>
    </div>
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Registration Form</h1>
          <p className="text-slate-500 text-sm mt-0.5">Drag fields to reorder. Click any field to edit its label, help text, options, and required status. Any field can be deleted.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {formStatus !== "draft" && (
            <Link href={publicUrl} target="_blank"
              className="px-4 py-2.5 border border-forest-200 text-forest-700 bg-forest-50 rounded-xl text-sm font-semibold hover:bg-forest-100 flex items-center gap-2">
              👁 Preview Form
            </Link>
          )}
          <button onClick={save} disabled={saving}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${saved ? "bg-forest-500 text-white" : "bg-gradient-to-r from-berry-500 to-berry-600 text-white hover:opacity-90"} disabled:opacity-60`}>
            {saved ? "✓ Saved!" : saving ? "Saving..." : "Save Form"}
          </button>
        </div>
      </div>

      {/* Form picker + publishing */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="block text-xs font-black uppercase tracking-wide text-slate-400 mb-1">Form</label>
            <select value={selectedFormId} onChange={e => loadForm(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-400/30">
              {forms.map(form => <option key={form.id} value={form.id}>{form.title}{form.isDefault ? " · default" : ""}</option>)}
            </select>
          </div>
          <button type="button" onClick={createForm} className="rounded-xl border border-forest-200 bg-forest-50 px-3 py-2 text-sm font-bold text-forest-700 hover:bg-forest-100">+ New Form</button>
          <div className="min-w-[220px] flex-1">
            <label className="block text-xs font-black uppercase tracking-wide text-slate-400 mb-1">Title</label>
            <input value={formTitle} onChange={e => setFormTitle(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-400/30" />
          </div>
          <div className="min-w-[180px]">
            <label className="block text-xs font-black uppercase tracking-wide text-slate-400 mb-1">Link slug</label>
            <input value={formSlug} onChange={e => setFormSlug(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-400/30" />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-wide text-slate-400 mb-1">Status</label>
            <select value={formStatus} onChange={e => setFormStatus(e.target.value as FormSummary["status"])} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-forest-400/30">
              <option value="draft">Draft</option>
              <option value="public">Public</option>
              <option value="linkOnly">Link only</option>
            </select>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
            <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="h-4 w-4 accent-forest-500" /> Default
          </label>
        </div>
        <div className={`mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 border ${formStatus !== "draft" && regOpen ? "bg-forest-50 border-forest-200" : "bg-slate-50 border-slate-200"}`}>
          <div>
            <p className="text-sm font-semibold text-slate-800">{formStatus === "draft" ? "⚪ Draft — not available to families" : formStatus === "linkOnly" ? "🔗 Link-only — available only with this link" : "🟢 Public form"}</p>
            {formStatus !== "draft" && <p className="text-xs text-slate-500 mt-0.5 font-mono break-all">{publicUrl}</p>}
          </div>
          {formStatus !== "draft" && <button onClick={() => navigator.clipboard.writeText(publicUrl)} className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium">📋 Copy Link</button>}
        </div>
      </div>

      <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-black text-sky-950">Class choices automation</p>
            <p className="mt-1 text-sm text-sky-800">When enabled, families first pick an <strong>Age Group</strong>, then the registration form automatically inserts a class-choice step using your Schedule Grid. Full classes hide themselves; newly opened seats reappear.</p>
            <p className={`mt-2 rounded-xl px-3 py-2 text-xs font-bold ${ageGroupReady ? "bg-forest-50 text-forest-800 border border-forest-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {ageGroupReady ? "✓ Age Group is present and required — families can register." : "⚠ Age Group MUST be on this form and marked required, or families cannot register."}
            </p>
          </div>
          <label className="flex min-w-[220px] items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white px-4 py-3 shadow-sm">
            <span>
              <span className="block text-sm font-black text-slate-800">Enable class choices</span>
              <span className="block text-xs text-slate-500">Turn off for a simple intake form.</span>
            </span>
            <input type="checkbox" checked={classChoicesEnabled} onChange={e => setClassChoicesEnabled(e.target.checked)} className="h-5 w-5 accent-forest-500" />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Field builder */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Form Fields ({fields.length})</h2>
            <div className="relative">
              <button onClick={() => setShowAddMenu(v => !v)}
                className="px-3 py-1.5 bg-forest-500 text-white rounded-lg text-xs font-semibold hover:bg-forest-600 flex items-center gap-1">
                + Add Field ▾
              </button>
              {showAddMenu && (
                <div className="absolute right-0 top-9 max-h-[70vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl z-20 p-2 w-80">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="text-sm font-black text-slate-800">Add form element</p>
                    <p className="text-xs text-slate-500">Jotform-style blocks: drag it later, tweak it instantly.</p>
                  </div>
                  {ADD_FIELD_CATEGORIES.map(category => (
                    <div key={category} className="py-1">
                      <p className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{category}</p>
                      {ADD_FIELD_TYPES.filter(t => t.category === category).map((t, idx) => (
                        <button key={`${t.type}-${t.label}-${idx}`} onClick={() => addField(t)}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-sky-50 rounded-xl flex items-start gap-2.5 transition-colors">
                          <span className="mt-0.5 text-slate-400 w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center font-mono text-xs">{t.icon}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block font-semibold text-slate-800">{t.label}</span>
                            {t.description && <span className="block text-xs text-slate-400 leading-snug">{t.description}</span>}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            {fields.map((field, i) => {
              const indentField = !isLayoutField(field);
              return (
              <div key={field.id}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={e => onDragOver(e, i)}
                onDrop={onDrop}
                className={`${indentField ? "ml-6 border-l-4 border-l-sky-100" : ""} bg-white border rounded-xl transition-all ${field.type === "pageBreak" ? "border-amber-200 bg-amber-50/60" : editingId === field.id ? "border-forest-400 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}>
                <div
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                  onClick={() => setEditingId(editingId === field.id ? null : field.id)}>
                  {/* Drag handle */}
                  <span className="text-slate-300 cursor-grab text-sm select-none">⠿</span>
                  {/* Type badge */}
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${indentField ? "bg-sky-50 text-sky-600" : field.type === "pageBreak" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                    {FIELD_ICONS[field.type] || field.type}
                  </span>
                  <span className={`flex-1 text-sm truncate ${indentField ? "font-medium text-slate-800" : "font-black text-slate-700"}`}>{field.label}</span>
                  {indentField && <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wide text-sky-500 bg-sky-50 px-2 py-0.5 rounded-full">field</span>}
                  {field.required && <span className="text-red-400 text-xs">*</span>}
                  {field.system && <span className="text-xs text-slate-300 bg-slate-50 px-1.5 rounded border border-slate-100">system</span>}
                  {field.type === "pageBreak" && <button type="button" onClick={e => { e.stopPropagation(); setPreviewPage(fields.slice(0, i).filter(f => f.type === "pageBreak").length + 1); }} className="text-xs font-bold text-amber-700 hover:text-amber-900">Preview next →</button>}
                  <span className="text-slate-400 text-xs">{editingId === field.id ? "▲" : "▼"}</span>
                  <button onClick={e => { e.stopPropagation(); removeField(field.id); }}
                    className="text-slate-300 hover:text-red-400 text-sm px-1">✕</button>
                </div>
                {editingId === field.id && field.type !== "divider" && field.type !== "pageBreak" && (
                  <FieldEditor field={field} onChange={updated => updateField(field.id, updated)} />
                )}
              </div>
            );})}
          </div>
        </div>

        {/* RIGHT — Live preview */}
        <div className="lg:sticky lg:top-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-700">Live Preview</h2>
            {previewPages.length > 1 && (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <button type="button" onClick={() => setPreviewPage(p => Math.max(0, p - 1))} disabled={currentPreviewPage === 0} className="rounded-lg border border-slate-200 bg-white px-2 py-1 disabled:opacity-40">←</button>
                Page {currentPreviewPage + 1} of {previewPages.length}
                <button type="button" onClick={() => setPreviewPage(p => Math.min(previewPages.length - 1, p + 1))} disabled={currentPreviewPage >= previewPages.length - 1} className="rounded-lg border border-slate-200 bg-white px-2 py-1 disabled:opacity-40">→</button>
              </div>
            )}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-h-[80vh] overflow-y-auto">
            <h1 className="text-xl font-bold text-slate-800 mb-1">{campName} Registration</h1>
            <p className="text-sm text-slate-500 mb-5">Fill out all required fields to complete registration.</p>
            {previewPages.length > 1 && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                Page break preview · families see this as page {currentPreviewPage + 1} of {previewPages.length}.
              </div>
            )}
            <div className="space-y-4">
              {previewPages[currentPreviewPage]?.length ? previewPages[currentPreviewPage].map(field => (
                <FieldPreview key={field.id} field={field} ageGroups={ageGroups} />
              )) : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">This preview page is empty. Drag fields below the page break to fill it.</div>}
            </div>
            {currentPreviewPage === previewPages.length - 1 && (
              <div className={`mt-5 rounded-2xl border p-4 ${classChoicesEnabled ? "border-forest-200 bg-forest-50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg ${classChoicesEnabled ? "bg-forest-100" : "bg-white"}`}>{classChoicesEnabled ? "🎨" : "📝"}</div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-800">{classChoicesEnabled ? "Auto-added classroom choices step" : "Class choices disabled for this form"}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {classChoicesEnabled
                        ? "Families will see the schedule here after they choose an Age Group. The app shows one choice per session, hides full classes, includes required sessions automatically, and saves enrollments when they submit."
                        : "Families will only complete the fields you build here. Use this for simple signups, interest forms, or non-scheduled events."}
                    </p>
                    {classChoicesEnabled && (
                      <div className="mt-3 space-y-2">
                        <div className="rounded-xl border border-forest-200 bg-white px-3 py-2">
                          <p className="text-xs font-bold text-forest-900">Session 1 · 9:00–10:00</p>
                          <p className="text-[11px] text-forest-700">Example choices based on selected age group: Art, Soccer, Robotics…</p>
                        </div>
                        <div className="rounded-xl border border-forest-200 bg-white px-3 py-2">
                          <p className="text-xs font-bold text-forest-900">Required Chapel · assigned automatically</p>
                          <p className="text-[11px] text-forest-700">Required blocks appear as included, not parent choices.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {previewPages.length > 1 && (
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setPreviewPage(p => Math.max(0, p - 1))} disabled={currentPreviewPage === 0} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 disabled:opacity-40">← Back</button>
                <button type="button" onClick={() => setPreviewPage(p => Math.min(previewPages.length - 1, p + 1))} disabled={currentPreviewPage >= previewPages.length - 1} className="flex-1 rounded-xl bg-gradient-to-r from-forest-500 to-forest-600 py-3 text-sm font-bold text-white disabled:opacity-40">Next page →</button>
              </div>
            )}
            {currentPreviewPage === previewPages.length - 1 && (
              <button disabled className="mt-6 w-full py-3 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-bold opacity-60 cursor-not-allowed">
                Submit Registration
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegistrationPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <RegistrationContent />
    </Suspense>
  );
}
