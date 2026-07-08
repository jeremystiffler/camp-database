"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { HelpCopy } from "@/components/HelpMode";

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
  familyRegistrationEnabled?: boolean;
  mandatoryClassRules?: MandatoryClassRule[];
  confirmationEmailSubject?: string;
  confirmationEmailIntro?: string;
  confirmationEmailTemplate?: string;
  adminNotificationEmails?: string;
  confirmationIncludeGuardian?: boolean;
  confirmationIncludeStudents?: boolean;
  confirmationIncludeClasses?: boolean;
  confirmationIncludeEmergency?: boolean;
  confirmationIncludePayment?: boolean;
}

interface CourseSummary {
  id: string;
  name: string;
  ageGroupId?: string | null;
  courseAgeGroups?: { ageGroupId: string }[];
}

type MandatoryClassRule = { ageGroupId: string; courseId: string };
type EmailBlockType = "hero" | "text" | "studentSchedule" | "guardian" | "emergency" | "additionalInfo" | "payment" | "footer";
type EmailTemplateBlock = { id: string; type: EmailBlockType; title?: string; content?: string; enabled?: boolean };

const FIELD_ICONS: Record<string, string> = {
  text: "Aa", email: "@", tel: "📞", date: "Date", number: "#", url: "🔗", select: "▾", textarea: "¶", checkbox: "☑", heading: "H", subheading: "ℹ", divider: "—", pageBreak: "↧",
};

type AddFieldCategory = "Basic" | "Contact" | "Choice" | "Program" | "Consent" | "Layout";
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
  { category: "Layout", type: "pageBreak", label: "Section break", icon: "↧", description: "Start a new page for the following fields", defaults: { label: "Section break" } },

  { category: "Basic", type: "text", label: "Short text", icon: "Aa", description: "Single-line answer", defaults: { label: "Short answer", placeholder: "Type your answer" } },
  { category: "Basic", type: "textarea", label: "Long text", icon: "¶", description: "Paragraph answer", defaults: { label: "Long answer", placeholder: "Type details here" } },
  { category: "Basic", type: "number", label: "Number", icon: "#", description: "Numeric answer", defaults: { label: "Number", placeholder: "0" } },
  { category: "Basic", type: "date", label: "Date picker", icon: "Date", description: "Calendar date", defaults: { label: "Date" } },
  { category: "Basic", type: "url", label: "Website / link", icon: "🔗", description: "URL field", defaults: { label: "Website", placeholder: "https://" } },

  { category: "Contact", type: "text", label: "Full name", icon: "👤", description: "Person name", defaults: { label: "Full name", placeholder: "First and last name" } },
  { category: "Contact", type: "email", label: "Email", icon: "@", description: "Email address", defaults: { label: "Email", placeholder: "name@example.com" } },
  { category: "Contact", type: "tel", label: "Phone", icon: "📞", description: "Phone number", defaults: { label: "Phone", placeholder: "(555) 555-5555" } },
  { category: "Contact", type: "textarea", label: "Address", icon: "🏠", description: "Mailing address", defaults: { label: "Address", placeholder: "Street, city, state, ZIP" } },

  { category: "Choice", type: "select", label: "Dropdown", icon: "▾", description: "Choose one from a menu", defaults: { label: "Dropdown", options: ["Option 1", "Option 2", "Option 3"] } },
  { category: "Choice", type: "checkbox", label: "Single checkbox", icon: "☑", description: "One acknowledgement", defaults: { label: "Agreement", checkboxDescription: "I agree to this statement." } },
  { category: "Choice", type: "checkbox", label: "Multiple checkboxes", icon: "☑☑", description: "Select all that apply", defaults: { label: "Select all that apply", options: ["Option 1", "Option 2", "Option 3"] } },
  { category: "Choice", type: "select", label: "Yes / No", icon: "Y/N", description: "Simple yes/no choice", defaults: { label: "Yes or no?", options: ["Yes", "No"] } },

  { category: "Program", type: "text", label: "Preferred name", icon: "🏷️", description: "Participant nickname", defaults: { label: "Preferred name", placeholder: "What should we call your participant?" } },
  { category: "Program", type: "text", label: "Grade / school", icon: "🎒", description: "Grade and school", defaults: { label: "Grade entering / school", placeholder: "Example: 4th grade, Liberty Elementary" } },
  { category: "Program", type: "select", label: "T-shirt size", icon: "👕", description: "Common shirt sizes", defaults: { label: "T-shirt size", options: ["Youth XS", "Youth S", "Youth M", "Youth L", "Youth XL", "Adult S", "Adult M", "Adult L", "Adult XL", "Adult 2XL"] } },
  { category: "Program", type: "textarea", label: "Allergies", icon: "⚕️", description: "Health safety", defaults: { label: "Allergies", placeholder: "Food, medication, insect, or environmental allergies" } },
  { category: "Program", type: "textarea", label: "Medications", icon: "💊", description: "Medication details", defaults: { label: "Medications", placeholder: "Medication name, dosage, schedule, and instructions" } },
  { category: "Program", type: "textarea", label: "Dietary needs", icon: "🥪", description: "Meal restrictions", defaults: { label: "Dietary restrictions or meal notes", placeholder: "Vegetarian, gluten-free, no pork, etc." } },
  { category: "Program", type: "textarea", label: "Accommodations", icon: "🤝", description: "Learning/access needs", defaults: { label: "Learning, behavioral, sensory, or accessibility needs", placeholder: "Anything that helps us serve your participant well" } },
  { category: "Program", type: "text", label: "Authorized pickup", icon: "🚗", description: "Approved adults", defaults: { label: "Authorized pickup people", placeholder: "Names of adults allowed to pick up this participant" } },
  { category: "Program", type: "text", label: "Not authorized pickup", icon: "🚫", description: "Restricted pickup", defaults: { label: "People not authorized for pickup", placeholder: "Optional" } },
  { category: "Program", type: "tel", label: "Emergency backup phone", icon: "☎️", description: "Backup contact", defaults: { label: "Backup emergency phone", placeholder: "If guardian cannot be reached" } },
  { category: "Program", type: "text", label: "Physician / clinic", icon: "🩺", description: "Medical contact", defaults: { label: "Physician or clinic", placeholder: "Doctor/clinic name and phone" } },
  { category: "Program", type: "text", label: "Insurance info", icon: "🛡️", description: "Policy details", defaults: { label: "Insurance provider / policy", placeholder: "Optional, if your program collects it" } },

  { category: "Consent", type: "checkbox", label: "Transportation permission", icon: "🚌", description: "Travel consent", defaults: { label: "Transportation permission", checkboxDescription: "I give permission for program-provided transportation when applicable." } },
  { category: "Consent", type: "checkbox", label: "Medical consent", icon: "Required", description: "Emergency care", defaults: { label: "Medical consent", checkboxDescription: "I authorize program staff to seek emergency medical care if needed.", required: true } },
  { category: "Consent", type: "checkbox", label: "Code of conduct", icon: "🤝", description: "Behavior agreement", defaults: { label: "Code of conduct", checkboxDescription: "I have reviewed the program expectations with my camper and agree to support them.", required: true } },
];

const ADD_FIELD_CATEGORIES: AddFieldCategory[] = ["Basic", "Contact", "Choice", "Program", "Consent", "Layout"];

const DEFAULT_EMAIL_BLOCKS: EmailTemplateBlock[] = [
  { id: "hero", type: "hero", title: "{{updateStatus}}", content: "Thanks for registering for {{campName}}. Below is the information we received.", enabled: true },
  { id: "students", type: "studentSchedule", title: "Student schedule", enabled: true },
  { id: "guardian", type: "guardian", title: "Parent / Guardian", enabled: true },
  { id: "emergency", type: "emergency", title: "Emergency Information", enabled: true },
  { id: "additional", type: "additionalInfo", title: "Additional Student Information", enabled: true },
  { id: "payment", type: "payment", title: "Payment Summary", enabled: true },
  { id: "footer", type: "footer", content: "Need to change something? Contact the program office, or return to the registration form and submit updated information.", enabled: true },
];

const EMAIL_BLOCK_LABELS: Record<EmailBlockType, string> = {
  hero: "Header / intro",
  text: "Custom text",
  studentSchedule: "Student + class schedule",
  guardian: "Guardian info",
  emergency: "Emergency info",
  additionalInfo: "Additional form answers",
  payment: "Payment summary",
  footer: "Footer note",
};

const STANDARD_EMAIL_TOKENS = ["campName", "guardianName", "guardianFirstName", "guardianLastName", "guardianEmail", "guardianPhone", "studentName", "studentFirstName", "studentLastName", "studentCount", "totalDue", "paymentStatus", "updateStatus"];

function parseEmailBlocks(value?: string) {
  if (!value) return DEFAULT_EMAIL_BLOCKS;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_EMAIL_BLOCKS;
    return parsed.map((block, index) => ({
      id: typeof block.id === "string" ? block.id : `email_${index}`,
      type: (block.type || "text") as EmailBlockType,
      title: typeof block.title === "string" ? block.title : "",
      content: typeof block.content === "string" ? block.content : "",
      enabled: block.enabled !== false,
    })).filter(block => EMAIL_BLOCK_LABELS[block.type]);
  } catch {
    return DEFAULT_EMAIL_BLOCKS;
  }
}

function cloneDefaultEmailBlocks() {
  return DEFAULT_EMAIL_BLOCKS.map(block => ({ ...block }));
}

const LAYOUT_FIELD_TYPES = new Set<FormField["type"]>(["heading", "subheading", "divider", "pageBreak"]);
const isLayoutField = (field: FormField) => LAYOUT_FIELD_TYPES.has(field.type);
const cleanOptionLines = (options?: string[]) => (options || []).map(option => option.trim()).filter(Boolean);
const sectionBreakLabel = (field: FormField) => field.label === "Page break" ? "Section break" : (field.label || "Section break");
const cleanFieldsForSave = (fields: FormField[]) => fields.map(field => ({
  ...field,
  label: field.type === "pageBreak" ? sectionBreakLabel(field) : field.label,
  options: field.type === "select" || field.type === "checkbox" ? cleanOptionLines(field.options) : field.options,
}));

function FieldPreview({ field, ageGroups }: { field: FormField; ageGroups: { id: string; name: string }[] }) {
  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none";
  if (field.type === "heading") return <h3 className="font-bold text-slate-800 text-base mt-2">{field.label}</h3>;
  if (field.type === "subheading") return (
    <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3">
      <p className="text-sm font-bold text-sky-900">{field.label}</p>
      {field.helpText && <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-sky-800">{field.helpText}</p>}
    </div>
  );
  if (field.type === "pageBreak") return <div className="my-5 flex items-center gap-3 text-xs font-black uppercase tracking-wide text-amber-700"><span className="h-px flex-1 bg-amber-200" /><span>{sectionBreakLabel(field)}</span><span className="h-px flex-1 bg-amber-200" /></div>;
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
          {(cleanOptionLines(field.options)?.length ? cleanOptionLines(field.options) : [field.checkboxDescription || field.label]).map(option => (
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
            : cleanOptionLines(field.options)?.map(o => <option key={o}>{o}</option>)}
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
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            onChange={e => onChange({ ...field, options: e.target.value.split("\n") })}
            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-forest-400 resize-y" />
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
  const [familyRegistrationEnabled, setFamilyRegistrationEnabled] = useState(false);
  const [confirmationEmailSubject, setConfirmationEmailSubject] = useState("{{campName}} registration confirmation");
  const [confirmationEmailIntro, setConfirmationEmailIntro] = useState("Thanks for registering for {{campName}}. Below is the information we received.");
  const [emailTemplateBlocks, setEmailTemplateBlocks] = useState<EmailTemplateBlock[]>(cloneDefaultEmailBlocks());
  const [adminNotificationEmails, setAdminNotificationEmails] = useState("");
  const [confirmationIncludeGuardian, setConfirmationIncludeGuardian] = useState(true);
  const [confirmationIncludeStudents, setConfirmationIncludeStudents] = useState(true);
  const [confirmationIncludeClasses, setConfirmationIncludeClasses] = useState(true);
  const [confirmationIncludeEmergency, setConfirmationIncludeEmergency] = useState(true);
  const [confirmationIncludePayment, setConfirmationIncludePayment] = useState(true);
  const [mandatoryClassRules, setMandatoryClassRules] = useState<MandatoryClassRule[]>([]);
  const [ageGroups, setAgeGroups]   = useState<{ id: string; name: string }[]>([]);
  const [courses, setCourses]       = useState<CourseSummary[]>([]);
  const [campName, setCampName]     = useState("");
  const [regOpen, setRegOpen]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [saveError, setSaveError]   = useState("");
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<"publish" | "classes" | "family" | "email">("publish");
  const dragIdx = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);
  const emailDragIdx = useRef<number | null>(null);
  const emailDragOverIdx = useRef<number | null>(null);

  const applyFormResponse = (d: { campName?: string; registrationOpen?: boolean; ageGroups?: { id: string; name: string }[]; courses?: CourseSummary[]; forms?: FormSummary[]; form?: FormSummary | null; fields?: unknown }) => {
    setCampName(d.campName || "");
    setRegOpen(d.registrationOpen || false);
    setAgeGroups(Array.isArray(d.ageGroups) ? d.ageGroups : []);
    setCourses(Array.isArray(d.courses) ? d.courses : []);
    setForms(Array.isArray(d.forms) ? d.forms : []);
    if (d.form) {
      setSelectedFormId(d.form.id);
      setFormTitle(d.form.title || "Registration Form");
      setFormSlug(d.form.slug || d.form.id);
      setFormStatus(d.form.status || "public");
      setIsDefault(Boolean(d.form.isDefault));
      setClassChoicesEnabled(d.form.classChoicesEnabled !== false);
      setFamilyRegistrationEnabled(Boolean(d.form.familyRegistrationEnabled));
      setConfirmationEmailSubject(d.form.confirmationEmailSubject || "{{campName}} registration confirmation");
      setConfirmationEmailIntro(d.form.confirmationEmailIntro || "Thanks for registering for {{campName}}. Below is the information we received.");
      setEmailTemplateBlocks(parseEmailBlocks(d.form.confirmationEmailTemplate));
      setAdminNotificationEmails(d.form.adminNotificationEmails || "");
      setConfirmationIncludeGuardian(d.form.confirmationIncludeGuardian !== false);
      setConfirmationIncludeStudents(d.form.confirmationIncludeStudents !== false);
      setConfirmationIncludeClasses(d.form.confirmationIncludeClasses !== false);
      setConfirmationIncludeEmergency(d.form.confirmationIncludeEmergency !== false);
      setConfirmationIncludePayment(d.form.confirmationIncludePayment !== false);
      setMandatoryClassRules(Array.isArray(d.form.mandatoryClassRules) ? d.form.mandatoryClassRules : []);
    }
    try { setFields(JSON.parse(typeof d.fields === "string" ? d.fields : JSON.stringify(d.fields))); } catch { setFields([]); }
  };

  const loadForm = (formRef?: string) => {
    if (!campId) return;
    setLoading(true);
    fetch(`/api/camps/${campId}/registration-form${formRef ? `?form=${encodeURIComponent(formRef)}` : ""}`, { cache: "no-store" })
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
    const r = await fetch(`/api/camps/${campId}/registration-form${formRef ? `?form=${encodeURIComponent(formRef)}` : ""}`, { cache: "no-store" });
    const d = await r.json();
    applyFormResponse(d);
  };

  const save = async (overrideFields?: FormField[]) => {
    setSaving(true); setSaved(false); setSaveError("");
    const fieldsToSave = overrideFields || fields;
    const cleanedFields = cleanFieldsForSave(fieldsToSave);
    try {
      const res = await fetch(`/api/camps/${campId}/registration-form`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ formId: selectedFormId, title: formTitle, slug: formSlug, status: formStatus, isDefault, classChoicesEnabled, familyRegistrationEnabled, mandatoryClassRules, confirmationEmailSubject, confirmationEmailIntro, confirmationEmailTemplate: JSON.stringify(emailTemplateBlocks), adminNotificationEmails, confirmationIncludeGuardian, confirmationIncludeStudents, confirmationIncludeClasses, confirmationIncludeEmergency, confirmationIncludePayment, fields: cleanedFields }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(d.error || "Could not save this form. Please try again.");
      }
      if (d.form) {
        setSelectedFormId(d.form.id);
        setFormTitle(d.form.title);
        setFormSlug(d.form.slug);
        setFormStatus(d.form.status);
        setIsDefault(d.form.isDefault);
        setClassChoicesEnabled(d.form.classChoicesEnabled !== false);
        setFamilyRegistrationEnabled(Boolean(d.form.familyRegistrationEnabled));
        setConfirmationEmailSubject(d.form.confirmationEmailSubject || "{{campName}} registration confirmation");
        setConfirmationEmailIntro(d.form.confirmationEmailIntro || "Thanks for registering for {{campName}}. Below is the information we received.");
        setEmailTemplateBlocks(parseEmailBlocks(d.form.confirmationEmailTemplate));
        setAdminNotificationEmails(d.form.adminNotificationEmails || "");
        setConfirmationIncludeGuardian(d.form.confirmationIncludeGuardian !== false);
        setConfirmationIncludeStudents(d.form.confirmationIncludeStudents !== false);
        setConfirmationIncludeClasses(d.form.confirmationIncludeClasses !== false);
        setConfirmationIncludeEmergency(d.form.confirmationIncludeEmergency !== false);
        setConfirmationIncludePayment(d.form.confirmationIncludePayment !== false);
        setMandatoryClassRules(Array.isArray(d.form.mandatoryClassRules) ? d.form.mandatoryClassRules : []);
      }
      try { setFields(JSON.parse(typeof d.fields === "string" ? d.fields : JSON.stringify(d.fields ?? cleanedFields))); } catch { setFields(cleanedFields); }
      await refreshForms(d.form?.id || selectedFormId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save this form. Please try again.");
    } finally {
      setSaving(false);
    }
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
    void save(arr);
    dragIdx.current = null; dragOverIdx.current = null;
  };

  const previewPages: FormField[][] = [fields];
  const currentPreviewPage = 0;
  const ageGroupField = fields.find(field => field.id === "f4" || field.source === "ageGroups");
  const ageGroupReady = Boolean(ageGroupField?.required);
  const eligibleCoursesForAgeGroup = (ageGroupId: string) => courses.filter(course =>
    course.ageGroupId === ageGroupId || Boolean(course.courseAgeGroups?.some(ag => ag.ageGroupId === ageGroupId))
  );
  const addMandatoryRule = () => {
    const firstAgeGroup = ageGroups[0]?.id || "";
    const firstCourse = firstAgeGroup ? eligibleCoursesForAgeGroup(firstAgeGroup)[0]?.id || "" : "";
    setMandatoryClassRules(prev => [...prev, { ageGroupId: firstAgeGroup, courseId: firstCourse }]);
  };
  const updateMandatoryRule = (index: number, updates: Partial<MandatoryClassRule>) => {
    setMandatoryClassRules(prev => prev.map((rule, idx) => {
      if (idx !== index) return rule;
      const next = { ...rule, ...updates };
      if (updates.ageGroupId) {
        const eligible = eligibleCoursesForAgeGroup(updates.ageGroupId);
        if (!eligible.some(course => course.id === next.courseId)) next.courseId = eligible[0]?.id || "";
      }
      return next;
    }));
  };
  const removeMandatoryRule = (index: number) => setMandatoryClassRules(prev => prev.filter((_, idx) => idx !== index));


  const fieldTokens = fields
    .filter(field => !isLayoutField(field))
    .map(field => `{{field:${field.label}}}`);
  const insertToken = (token: string) => navigator.clipboard.writeText(token);
  const updateEmailBlock = (id: string, updates: Partial<EmailTemplateBlock>) => setEmailTemplateBlocks(prev => prev.map(block => block.id === id ? { ...block, ...updates } : block));
  const addEmailBlock = (type: EmailBlockType = "text") => setEmailTemplateBlocks(prev => [...prev, { id: `email_${Date.now()}`, type, title: type === "text" ? "New section" : EMAIL_BLOCK_LABELS[type], content: "", enabled: true }]);
  const removeEmailBlock = (id: string) => setEmailTemplateBlocks(prev => prev.filter(block => block.id !== id));
  const onEmailDragStart = (i: number) => { emailDragIdx.current = i; };
  const onEmailDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); emailDragOverIdx.current = i; };
  const onEmailDrop = () => {
    if (emailDragIdx.current === null || emailDragOverIdx.current === null) return;
    const arr = [...emailTemplateBlocks];
    const [moved] = arr.splice(emailDragIdx.current, 1);
    arr.splice(emailDragOverIdx.current, 0, moved);
    setEmailTemplateBlocks(arr);
    emailDragIdx.current = null; emailDragOverIdx.current = null;
  };

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/register/${campId}${formSlug ? `?form=${encodeURIComponent(formSlug)}` : ""}`
    : `/register/${campId}${formSlug ? `?form=${encodeURIComponent(formSlug)}` : ""}`;

  if (!campId) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center"><span className="text-4xl mb-3 block">Form</span><p>Select a program to manage its registration form.</p></div>
    </div>
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Registration Form</h1>
          <HelpCopy title="Form builder" className="text-slate-500 text-sm mt-0.5">Drag fields to reorder. Click any field to edit its label, help text, options, and required status. Any field can be deleted.</HelpCopy>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {formStatus !== "draft" && (
            <Link href={publicUrl} target="_blank"
              className="px-4 py-2.5 border border-forest-200 text-forest-700 bg-forest-50 rounded-xl text-sm font-semibold hover:bg-forest-100 flex items-center gap-2">
              👁 Preview Form
            </Link>
          )}
          <button onClick={() => save()} disabled={saving}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${saved ? "bg-forest-500 text-white" : "bg-gradient-to-r from-berry-500 to-berry-600 text-white hover:opacity-90"} disabled:opacity-60`}>
            {saved ? "✓ Saved!" : saving ? "Saving..." : "Save Form"}
          </button>
          {saveError && <p className="basis-full text-right text-xs font-bold text-red-500">{saveError}</p>}
        </div>
      </div>

      {/* Minimal form setup workspace */}
      <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-sky-50 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Form setup</p>
              <h2 className="mt-1 text-lg font-black text-slate-900">Settings</h2>
              <HelpCopy title="Registration settings" className="mt-1 text-sm text-slate-500">Choose a section on the left, adjust only what matters, then save.</HelpCopy>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className={`rounded-full px-3 py-1 ${formStatus === "draft" ? "bg-slate-100 text-slate-600" : formStatus === "linkOnly" ? "bg-sky-100 text-sky-700" : "bg-forest-100 text-forest-700"}`}>{formStatus === "draft" ? "Draft" : formStatus === "linkOnly" ? "Link only" : "Public"}</span>
              <span className={`rounded-full px-3 py-1 ${classChoicesEnabled ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>{classChoicesEnabled ? "Class choices on" : "Simple intake"}</span>
              <span className={`rounded-full px-3 py-1 ${familyRegistrationEnabled ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{familyRegistrationEnabled ? "Family mode" : "One camper"}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
          <div className="border-b border-slate-100 bg-slate-50/70 p-3 lg:border-b-0 lg:border-r">
            {[
              { key: "publish", title: "Basics & link", desc: formStatus === "draft" ? "Not live" : "Ready to share", icon: "🔗" },
              { key: "classes", title: "Class choices", desc: classChoicesEnabled ? `${mandatoryClassRules.length} required rule${mandatoryClassRules.length === 1 ? "" : "s"}` : "Disabled", icon: "Classes" },
              { key: "family", title: "Family mode", desc: familyRegistrationEnabled ? "Multiple students" : "Single student", icon: "Family" },
              { key: "email", title: "Confirmation email", desc: adminNotificationEmails.trim() ? "Family + admin alerts" : "Subject, intro, sections", icon: "✉️" },
            ].map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSettingsPanel(item.key as "publish" | "classes" | "family" | "email")}
                className={`mb-2 flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${settingsPanel === item.key ? "border-slate-900 bg-white shadow-sm" : "border-transparent bg-transparent hover:border-slate-200 hover:bg-white"}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-base shadow-sm ring-1 ring-slate-100">{item.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-slate-800">{item.title}</span>
                  <span className="block truncate text-xs text-slate-500">{item.desc}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="p-5">
            {settingsPanel === "publish" && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                  <label className="block">
                    <span className="block text-xs font-black uppercase tracking-wide text-slate-400 mb-1">Active form</span>
                    <select value={selectedFormId} onChange={e => loadForm(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-400/30">
                      {forms.map(form => <option key={form.id} value={form.id}>{form.title}{form.isDefault ? " · default" : ""}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={createForm} className="rounded-xl border border-forest-200 bg-forest-50 px-3 py-2 text-sm font-bold text-forest-700 hover:bg-forest-100">+ New Form</button>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_180px_150px]">
                  <label className="block">
                    <span className="block text-xs font-black uppercase tracking-wide text-slate-400 mb-1">Title</span>
                    <input value={formTitle} onChange={e => setFormTitle(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-400/30" />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-black uppercase tracking-wide text-slate-400 mb-1">Link slug</span>
                    <input value={formSlug} onChange={e => setFormSlug(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-400/30" />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-black uppercase tracking-wide text-slate-400 mb-1">Status</span>
                    <select value={formStatus} onChange={e => setFormStatus(e.target.value as FormSummary["status"])} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-forest-400/30">
                      <option value="draft">Draft</option>
                      <option value="public">Public</option>
                      <option value="linkOnly">Link only</option>
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="h-4 w-4 accent-forest-500" /> Make this the default form
                  </label>
                  <span className="hidden h-5 w-px bg-slate-200 sm:block" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700">{formStatus === "draft" ? "⚪ Draft — hidden from families" : formStatus === "linkOnly" ? "🔗 Link-only — available only with this URL" : "🟢 Public form — discoverable and shareable"}</p>
                    {formStatus !== "draft" && <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{publicUrl}</p>}
                  </div>
                  {formStatus !== "draft" && <button onClick={() => navigator.clipboard.writeText(publicUrl)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Copy Link</button>}
                </div>
              </div>
            )}

            {settingsPanel === "classes" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                  <div className="max-w-2xl">
                    <p className="text-sm font-black text-sky-950">Class choices automation</p>
                    <HelpCopy title="Class choices" className="mt-1 text-sm text-sky-800">Families pick an <strong>Age Group</strong>, then the form inserts class choices from your Schedule Grid. Full classes hide themselves; opened seats reappear.</HelpCopy>
                    <p className={`mt-2 rounded-xl px-3 py-2 text-xs font-bold ${ageGroupReady ? "bg-forest-50 text-forest-800 border border-forest-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                      {ageGroupReady ? "✓ Age Group is present and required." : "⚠ Age Group must be on this form and marked required before families can register."}
                    </p>
                  </div>
                  <label className="flex min-w-[220px] items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white px-4 py-3 shadow-sm">
                    <span>
                      <span className="block text-sm font-black text-slate-800">Enable class choices</span>
                      <span className="block text-xs text-slate-500">Turn off for simple intake.</span>
                    </span>
                    <input type="checkbox" checked={classChoicesEnabled} onChange={e => setClassChoicesEnabled(e.target.checked)} className="h-5 w-5 accent-forest-500" />
                  </label>
                </div>

                {classChoicesEnabled && (
                  <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-2xl">
                        <p className="text-sm font-black text-indigo-950">Required class choices by age group</p>
                        <HelpCopy title="Required class choices" className="mt-1 text-sm leading-relaxed text-indigo-800">Use only when an age group must choose a specific class in any available time slot.</HelpCopy>
                      </div>
                      <button type="button" onClick={addMandatoryRule} disabled={ageGroups.length === 0 || courses.length === 0} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50">+ Add required class</button>
                    </div>
                    {mandatoryClassRules.length === 0 ? (
                      <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">No required class-choice rules yet.</div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {mandatoryClassRules.map((rule, index) => {
                          const eligible = eligibleCoursesForAgeGroup(rule.ageGroupId);
                          return (
                            <div key={`${rule.ageGroupId}-${rule.courseId}-${index}`} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                              <label className="block">
                                <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">Age group</span>
                                <select value={rule.ageGroupId} onChange={e => updateMandatoryRule(index, { ageGroupId: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30">
                                  {ageGroups.map(ageGroup => <option key={ageGroup.id} value={ageGroup.id}>{ageGroup.name}</option>)}
                                </select>
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">Required class</span>
                                <select value={rule.courseId} onChange={e => updateMandatoryRule(index, { courseId: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30">
                                  <option value="">Select a class…</option>
                                  {eligible.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
                                </select>
                                {eligible.length === 0 && <p className="mt-1 text-[11px] font-bold text-red-600">No classes are assigned to this age group yet.</p>}
                              </label>
                              <button type="button" onClick={() => removeMandatoryRule(index)} className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50">Remove</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {settingsPanel === "family" && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="text-sm font-black text-amber-950">Family registration mode</p>
                    <HelpCopy title="Family registration" className="mt-1 text-sm text-amber-800">One guardian can add multiple students, choose classes for each child, pay once, and receive one family confirmation email.</HelpCopy>
                  </div>
                  <label className="flex min-w-[240px] items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-sm">
                    <span>
                      <span className="block text-sm font-black text-slate-800">Allow multiple students</span>
                      <span className="block text-xs text-slate-500">Best for siblings and households.</span>
                    </span>
                    <input type="checkbox" checked={familyRegistrationEnabled} onChange={e => setFamilyRegistrationEnabled(e.target.checked)} className="h-5 w-5 accent-amber-500" />
                  </label>
                </div>
              </div>
            )}

            {settingsPanel === "email" && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-black text-berry-950">Confirmation email builder</p>
                  <HelpCopy title="Confirmation email" className="mt-1 text-sm text-berry-800">Drag sections into the order you want. Use tokens from program data, guardian data, student data, and your form fields.</HelpCopy>
                </div>
                <div className="grid gap-3">
                  <label className="block">
                    <span className="block text-xs font-black uppercase tracking-wide text-slate-400 mb-1">Subject</span>
                    <input value={confirmationEmailSubject} onChange={e => setConfirmationEmailSubject(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-berry-400/30" />
                  </label>
                  <label className="block rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
                    <span className="block text-xs font-black uppercase tracking-wide text-amber-700 mb-1">Admin notification emails</span>
                    <textarea rows={2} value={adminNotificationEmails} onChange={e => setAdminNotificationEmails(e.target.value)} placeholder={"director@example.com\nregistrar@example.com"} className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30 resize-none" />
                    <HelpCopy title="Admin notifications" className="mt-1 text-xs font-semibold text-amber-800">Optional. Enter any number of admin emails, separated by commas or new lines.</HelpCopy>
                  </label>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Available tokens</p>
                        <HelpCopy title="Email tokens" className="text-xs text-slate-500">Click a tag to copy it, then paste it into any editable section.</HelpCopy>
                      </div>
                      <button type="button" onClick={() => setEmailTemplateBlocks(cloneDefaultEmailBlocks())} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100">Reset default layout</button>
                    </div>
                    <div className="mt-3 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                      {STANDARD_EMAIL_TOKENS.map(token => <button key={token} type="button" onClick={() => insertToken(`{{${token}}}`)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-mono font-bold text-slate-600 hover:border-berry-300 hover:text-berry-700">{`{{${token}}}`}</button>)}
                      {fieldTokens.map(token => <button key={token} type="button" onClick={() => insertToken(token)} className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-mono font-bold text-sky-700 hover:border-sky-400">{token}</button>)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-berry-100 bg-white p-3 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-slate-900">Email sections</p>
                        <HelpCopy title="Email sections" className="text-xs text-slate-500">Drag with the handle. Toggle sections on/off. Custom text sections can use tokens.</HelpCopy>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => addEmailBlock("text")} className="rounded-xl bg-berry-600 px-3 py-2 text-xs font-black text-white hover:bg-berry-700">+ Text block</button>
                        <button type="button" onClick={() => addEmailBlock("footer")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">+ Footer</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {emailTemplateBlocks.map((block, index) => {
                        const editableText = block.type === "hero" || block.type === "text" || block.type === "footer";
                        const editableTitle = block.type === "hero" || block.type === "text" || block.type === "emergency" || block.type === "additionalInfo";
                        return (
                          <div key={block.id} draggable onDragStart={() => onEmailDragStart(index)} onDragOver={e => onEmailDragOver(e, index)} onDrop={onEmailDrop} className={`rounded-2xl border p-3 ${block.enabled === false ? "border-slate-200 bg-slate-50 opacity-70" : "border-slate-200 bg-white"}`}>
                            <div className="flex items-center gap-3">
                              <span className="cursor-grab select-none text-slate-300">⠿</span>
                              <select value={block.type} onChange={e => updateEmailBlock(block.id, { type: e.target.value as EmailBlockType, title: block.title || EMAIL_BLOCK_LABELS[e.target.value as EmailBlockType] })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700">
                                {Object.entries(EMAIL_BLOCK_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                              </select>
                              <span className="flex-1 text-sm font-black text-slate-800">{EMAIL_BLOCK_LABELS[block.type]}</span>
                              <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500"><input type="checkbox" checked={block.enabled !== false} onChange={e => updateEmailBlock(block.id, { enabled: e.target.checked })} /> Show</label>
                              <button type="button" onClick={() => removeEmailBlock(block.id)} className="text-sm text-slate-300 hover:text-red-500">✕</button>
                            </div>
                            {editableTitle && (
                              <input value={block.title || ""} onChange={e => updateEmailBlock(block.id, { title: e.target.value })} placeholder="Section title" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-berry-400/30" />
                            )}
                            {editableText ? (
                              <textarea rows={block.type === "hero" ? 3 : 2} value={block.content || ""} onChange={e => updateEmailBlock(block.id, { content: e.target.value })} placeholder="Write email text here. Tokens are supported." className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-berry-400/30" />
                            ) : (
                              <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">Auto-generated from registration data: {EMAIL_BLOCK_LABELS[block.type]}.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
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
                  <span className={`flex-1 text-sm truncate ${indentField ? "font-medium text-slate-800" : "font-black text-slate-700"}`}>{field.type === "pageBreak" ? sectionBreakLabel(field) : field.label}</span>
                  {indentField && <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wide text-sky-500 bg-sky-50 px-2 py-0.5 rounded-full">field</span>}
                  {field.required && <span className="text-red-400 text-xs">*</span>}
                  {field.system && <span className="text-xs text-slate-300 bg-slate-50 px-1.5 rounded border border-slate-100">system</span>}
                  {field.type === "pageBreak" && <button type="button" onClick={e => { e.stopPropagation(); }} className="text-xs font-bold text-amber-700">Section divider</button>}
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
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-h-[80vh] overflow-y-auto">
            <h1 className="text-xl font-bold text-slate-800 mb-1">{campName} Registration</h1>
            <p className="text-sm text-slate-500 mb-5">Fill out all required fields to complete registration.</p>
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
