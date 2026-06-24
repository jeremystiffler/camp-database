"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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

const FIELD_ICONS: Record<string, string> = {
  text: "Aa", email: "@", tel: "📞", date: "📅", select: "▾", textarea: "¶", checkbox: "☑", heading: "H", divider: "—",
};

const ADD_FIELD_TYPES: { type: FormField["type"]; label: string; icon: string }[] = [
  { type: "text",     label: "Text input",   icon: "Aa" },
  { type: "email",    label: "Email",        icon: "@"  },
  { type: "tel",      label: "Phone",        icon: "📞" },
  { type: "date",     label: "Date",         icon: "📅" },
  { type: "select",   label: "Dropdown",     icon: "▾"  },
  { type: "textarea", label: "Long text",    icon: "¶"  },
  { type: "checkbox", label: "Checkbox",     icon: "☑"  },
  { type: "heading",  label: "Section heading", icon: "H" },
  { type: "divider",  label: "Divider",      icon: "—"  },
];

function FieldPreview({ field, ageGroups }: { field: FormField; ageGroups: { id: string; name: string }[] }) {
  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none";
  if (field.type === "heading") return <h3 className="font-bold text-slate-800 text-base mt-2">{field.label}</h3>;
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
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" disabled className="w-4 h-4" /> {field.label}
        </label>
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
          <label className="block text-xs font-medium text-slate-500 mb-1">Label</label>
          <input value={field.label} onChange={e => onChange({ ...field, label: e.target.value })}
            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-forest-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Placeholder</label>
          <input value={field.placeholder || ""} onChange={e => onChange({ ...field, placeholder: e.target.value })}
            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-forest-400" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Help text</label>
        <input value={field.helpText || ""} onChange={e => onChange({ ...field, helpText: e.target.value })}
          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-forest-400" />
      </div>
      {field.type === "select" && !field.source && (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Options (one per line)</label>
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
  const [ageGroups, setAgeGroups]   = useState<{ id: string; name: string }[]>([]);
  const [campName, setCampName]     = useState("");
  const [regOpen, setRegOpen]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  useEffect(() => {
    if (!campId) return;
    fetch(`/api/camps/${campId}/registration-form`)
      .then(r => r.json())
      .then(d => {
        setCampName(d.campName || "");
        setRegOpen(d.registrationOpen || false);
        setAgeGroups(Array.isArray(d.ageGroups) ? d.ageGroups : []);
        try { setFields(JSON.parse(typeof d.fields === "string" ? d.fields : JSON.stringify(d.fields))); } catch { setFields([]); }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [campId]);

  const save = async () => {
    setSaving(true); setSaved(false);
    await fetch(`/api/camps/${campId}/registration-form`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addField = (type: FormField["type"]) => {
    const newField: FormField = {
      id: `custom_${Date.now()}`,
      type,
      label: ADD_FIELD_TYPES.find(t => t.type === type)?.label || "New field",
      required: false,
    };
    setFields(prev => [...prev, newField]);
    setEditingId(newField.id);
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

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/register/${campId}` : `/register/${campId}`;

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
          <p className="text-slate-500 text-sm mt-0.5">Drag fields to reorder. Click a field to edit. System fields can&apos;t be deleted.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {regOpen && (
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

      {/* Registration status banner */}
      <div className={`flex items-center justify-between px-5 py-3.5 rounded-xl mb-6 border ${regOpen ? "bg-forest-50 border-forest-200" : "bg-slate-50 border-slate-200"}`}>
        <div>
          <p className="text-sm font-semibold text-slate-800">{regOpen ? "🟢 Registration is Open" : "🔴 Registration is Closed"}</p>
          {regOpen && <p className="text-xs text-slate-500 mt-0.5 font-mono">{publicUrl}</p>}
        </div>
        <div className="flex items-center gap-3">
          {regOpen && (
            <button onClick={() => navigator.clipboard.writeText(publicUrl)}
              className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium">
              📋 Copy Link
            </button>
          )}
          <Link href={`/settings?campId=${campId}`}
            className="text-xs text-slate-500 hover:text-slate-700 underline">
            Toggle in Settings →
          </Link>
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
                <div className="absolute right-0 top-9 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 w-44">
                  {ADD_FIELD_TYPES.map(t => (
                    <button key={t.type} onClick={() => addField(t.type)}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5">
                      <span className="text-slate-400 w-5 text-center font-mono text-xs">{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            {fields.map((field, i) => (
              <div key={field.id}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={e => onDragOver(e, i)}
                onDrop={onDrop}
                className={`bg-white border rounded-xl transition-all ${editingId === field.id ? "border-forest-400 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}>
                <div
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                  onClick={() => setEditingId(editingId === field.id ? null : field.id)}>
                  {/* Drag handle */}
                  <span className="text-slate-300 cursor-grab text-sm select-none">⠿</span>
                  {/* Type badge */}
                  <span className="text-xs font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                    {FIELD_ICONS[field.type] || field.type}
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-800 truncate">{field.label}</span>
                  {field.required && <span className="text-red-400 text-xs">*</span>}
                  {field.system && <span className="text-xs text-slate-300 bg-slate-50 px-1.5 rounded border border-slate-100">system</span>}
                  <span className="text-slate-400 text-xs">{editingId === field.id ? "▲" : "▼"}</span>
                  {!field.system && (
                    <button onClick={e => { e.stopPropagation(); removeField(field.id); }}
                      className="text-slate-300 hover:text-red-400 text-sm px-1">✕</button>
                  )}
                </div>
                {editingId === field.id && field.type !== "divider" && (
                  <FieldEditor field={field} onChange={updated => updateField(field.id, updated)} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Live preview */}
        <div className="lg:sticky lg:top-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Live Preview</h2>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-h-[80vh] overflow-y-auto">
            <h1 className="text-xl font-bold text-slate-800 mb-1">{campName} Registration</h1>
            <p className="text-sm text-slate-500 mb-5">Fill out all required fields to complete registration.</p>
            <div className="space-y-4">
              {fields.map(field => (
                <FieldPreview key={field.id} field={field} ageGroups={ageGroups} />
              ))}
            </div>
            <button disabled className="mt-6 w-full py-3 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-bold opacity-60 cursor-not-allowed">
              Submit Registration
            </button>
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
