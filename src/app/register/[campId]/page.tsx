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
interface ProgramAppearance { primaryColor: string; accentColor: string; fontFamily: string; }
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

type MandatoryClassRule = { ageGroupId: string; courseId: string };

type FieldValue = string | boolean | string[];
type Step = 1 | 2 | 3;
type FormPage = { id: string; title?: string; fields: FormField[] };
type StudentState = { id: string; values: Record<string, FieldValue>; selectedBySession: Record<string, string> };
const makeStudent = (index: number): StudentState => ({ id: `student-${Date.now()}-${index}`, values: {}, selectedBySession: {} });

const PARENT_FIELD_IDS = new Set(["f5", "f6", "f7"]);
const STUDENT_FIELD_IDS = new Set(["f1", "f2", "f3", "f4"]);
const CONSENT_FIELD_IDS = new Set(["f8", "f9", "f10", "f11", "f12"]);
const SYSTEM_FIELD_IDS = new Set(["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12"]);

const isInputField = (field: FormField) => {
  return !["heading", "subheading", "divider", "pageBreak"].includes(field.type);
};
const sectionBreakLabel = (field: FormField) => field.label === "Page break" ? "Section break" : (field.label || "Section break");
const splitFieldsIntoPages = (sourceFields: FormField[]): FormPage[] => {
  const pages: FormPage[] = [{ id: "page-1", fields: [] }];
  sourceFields.forEach(field => {
    if (field.type === "pageBreak") {
      pages.push({ id: field.id, title: sectionBreakLabel(field), fields: [] });
    } else {
      pages[pages.length - 1].fields.push(field);
    }
  });
  return pages.filter(page => page.fields.length > 0);
};

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

function optionFillRate(option: SessionOption): number | null {
  if (!option.cap || option.cap <= 0 || option.seatsLeft === null) return null;
  return Math.min(Math.max((option.cap - option.seatsLeft) / option.cap, 0), 1);
}

function optionCapacityClass(option: SessionOption, checked: boolean, unavailable: boolean): string {
  if (unavailable) return "border-slate-200 bg-slate-50 opacity-55 cursor-not-allowed";
  if (checked) return "border-forest-300 bg-forest-50 ring-2 ring-forest-200 cursor-pointer";
  const rate = optionFillRate(option);
  if (rate === null) return "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 cursor-pointer";
  if (rate >= 0.9) return "border-orange-300 bg-orange-50 hover:bg-orange-100 cursor-pointer";
  if (rate >= 0.75) return "border-amber-300 bg-amber-50 hover:bg-amber-100 cursor-pointer";
  if (rate >= 0.5) return "border-sky-200 bg-sky-50 hover:bg-sky-100 cursor-pointer";
  return "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 cursor-pointer";
}

function optionSeatBadgeClass(option: SessionOption, unavailable: boolean): string {
  if (unavailable) return "text-slate-600 bg-slate-200 border border-slate-300";
  const rate = optionFillRate(option);
  if (rate === null) return "text-emerald-800 bg-emerald-100 border border-emerald-200";
  if (rate >= 0.9) return "text-orange-900 bg-orange-100 border border-orange-300";
  if (rate >= 0.75) return "text-amber-900 bg-amber-100 border border-amber-300";
  if (rate >= 0.5) return "text-sky-900 bg-sky-100 border border-sky-200";
  return "text-emerald-800 bg-emerald-100 border border-emerald-200";
}

function optionCapacityLabel(option: SessionOption): string {
  const rate = optionFillRate(option);
  if (rate === null) return "Open seats";
  if (rate >= 0.9) return "Nearly full";
  if (rate >= 0.75) return "Filling fast";
  if (rate >= 0.5) return "Half full";
  return "Roomy";
}

function PublicRegistrationContent({ params }: { params: Promise<{ campId: string }> }) {
  const searchParams = useSearchParams();
  const [campId, setCampId]         = useState("");
  const [campName, setCampName]     = useState("");
  const [appearance, setAppearance] = useState<ProgramAppearance>({ primaryColor: "#64748B", accentColor: "#475569", fontFamily: "Inter" });
  const [fields, setFields]         = useState<FormField[]>([]);
  const [ageGroups, setAgeGroups]   = useState<AgeGroup[]>([]);
  const [courses, setCourses]       = useState<Course[]>([]);
  const [registrationSessions, setRegistrationSessions] = useState<RegistrationSession[]>([]);
  const [classChoicesEnabled, setClassChoicesEnabled] = useState(true);
  const [familyRegistrationEnabled, setFamilyRegistrationEnabled] = useState(false);
  const [mandatoryClassRules, setMandatoryClassRules] = useState<MandatoryClassRule[]>([]);
  const [formRef, setFormRef] = useState("");
  const [regOpen, setRegOpen]       = useState(false);
  const [billingMode, setBillingMode] = useState<"campPays" | "camperFee">("campPays");
  const [platformFeeCents, setPlatformFeeCents] = useState(300);
  const [platformFeePercentBps, setPlatformFeePercentBps] = useState(300);
  const [platformFeeMinCents, setPlatformFeeMinCents] = useState(200);
  const [platformFeeCapCents, setPlatformFeeCapCents] = useState(2500);
  const [camperPriceCents, setCamperPriceCents] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscountCents, setCouponDiscountCents] = useState(0);
  const [couponMsg, setCouponMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [paymentNotice, setPaymentNotice] = useState("");
  const [loading, setLoading]       = useState(true);
  const [values, setValues]         = useState<Record<string, FieldValue>>({});
  const [students, setStudents] = useState<StudentState[]>(() => [makeStudent(1)]);
  const [activeStudentIndex, setActiveStudentIndex] = useState(0);
  const [selectedBySession, setSelectedBySession] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [submittedUpdated, setSubmittedUpdated] = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [step, setStep]             = useState<Step>(1);
  const [sectionPageIndex, setSectionPageIndex] = useState(0);
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
          setAppearance({
            primaryColor: /^#[0-9a-f]{6}$/i.test(d.primaryColor || "") ? d.primaryColor : "#64748B",
            accentColor: /^#[0-9a-f]{6}$/i.test(d.accentColor || "") ? d.accentColor : "#475569",
            fontFamily: ["Inter", "Poppins", "Georgia", "Merriweather", "Courier New", "Trebuchet MS"].includes(d.fontFamily) ? d.fontFamily : "Inter",
          });
          setRegOpen(d.registrationOpen || false);
          setBillingMode(d.billingMode === "camperFee" ? "camperFee" : "campPays");
          setPlatformFeeCents(Number(d.platformFeeCents || 300));
          setPlatformFeePercentBps(Number(d.platformFeePercentBps || 300));
          setPlatformFeeMinCents(Number(d.platformFeeMinCents || 200));
          setPlatformFeeCapCents(Number(d.platformFeeCapCents || 2500));
          setCamperPriceCents(Number(d.camperPriceCents || 0));
          setPaymentNotice(searchParams.get("payment") === "success" ? "Payment received — thank you!" : searchParams.get("payment") === "cancelled" ? "Payment was cancelled. You can submit another registration when ready." : "");
          setAgeGroups(Array.isArray(d.ageGroups) ? d.ageGroups : []);
          setCourses(Array.isArray(d.courses) ? d.courses : []);
          setRegistrationSessions(Array.isArray(d.registrationSessions) ? d.registrationSessions : []);
          setClassChoicesEnabled(d.form?.classChoicesEnabled !== false);
          setFamilyRegistrationEnabled(Boolean(d.form?.familyRegistrationEnabled));
          setMandatoryClassRules(Array.isArray(d.form?.mandatoryClassRules) ? d.form.mandatoryClassRules : []);
          try {
            const parsed = typeof d.fields === "string" ? JSON.parse(d.fields) : d.fields;
            setFields(Array.isArray(parsed) ? parsed : []);
          } catch { setFields([]); }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });
  }, [params, searchParams]);

  const activeStudent = students[Math.min(activeStudentIndex, students.length - 1)] || students[0];
  const activeStudentValues = activeStudent?.values || {};
  const activeValues = familyRegistrationEnabled ? { ...values, ...activeStudentValues } : values;
  const activeSelectedBySession = familyRegistrationEnabled ? (activeStudent?.selectedBySession || {}) : selectedBySession;
  const activeStudentCount = familyRegistrationEnabled ? students.length : 1;
  const isGuardianField = (id: string) => PARENT_FIELD_IDS.has(id);

  const setValue = (id: string, val: FieldValue) => {
    if (familyRegistrationEnabled && !isGuardianField(id)) {
      setStudents(prev => prev.map((student, idx) => idx === activeStudentIndex
        ? { ...student, values: { ...student.values, [id]: val }, selectedBySession: id === "f4" ? {} : student.selectedBySession }
        : student));
    } else {
      setValues(prev => {
        const next = { ...prev, [id]: val };
        if (id === "f4") setSelectedBySession({});
        return next;
      });
    }
    if (errors[id]) setErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (errors._form) setErrors(prev => { const n = { ...prev }; delete n._form; return n; });
  };

  const toggleCheckboxOption = (id: string, option: string, checked: boolean) => {
    const current = Array.isArray(activeValues[id]) ? activeValues[id] as string[] : [];
    const next = checked ? [...new Set([...current, option])] : current.filter(v => v !== option);
    setValue(id, next);
  };

  const fieldsForStep = (targetStep: Step) => {
    const consentIndex = fields.findIndex(field => field.id === "section_consent");
    const stepOneFields = consentIndex >= 0 ? fields.slice(0, consentIndex) : fields.filter(field => PARENT_FIELD_IDS.has(field.id) || STUDENT_FIELD_IDS.has(field.id));
    const stepThreeFields = consentIndex >= 0 ? fields.slice(consentIndex) : fields.filter(field => CONSENT_FIELD_IDS.has(field.id) || (!field.system && isInputField(field)) || !isInputField(field));
    if (targetStep === 1) return stepOneFields;
    if (targetStep === 3) return stepThreeFields;
    return [];
  };

  const pagesForStep = (targetStep: Step) => splitFieldsIntoPages(fieldsForStep(targetStep));

  const selectedAgeGroupId = String(activeValues.f4 || "");
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
  const requiredSessions = selectableSessions.filter(session =>
    !session.mandatory && !session.mandatorySessions?.some(ms => ms.ageGroupId === selectedAgeGroupId) && session.optionCount > 0
  );
  const requiredClassRulesForAgeGroup = mandatoryClassRules.filter(rule => rule.ageGroupId === selectedAgeGroupId && rule.courseId);
  const courseNameById = new Map(courses.map(course => [course.id, course.name]));
  const selectedCourseIdsForActiveStudent = [...new Set(Object.values(activeSelectedBySession).filter(Boolean))];
  const missingRequiredClassRules = requiredClassRulesForAgeGroup.filter(rule => !selectedCourseIdsForActiveStudent.includes(rule.courseId));
  const requiredClassNames = requiredClassRulesForAgeGroup.map(rule => courseNameById.get(rule.courseId)).filter(Boolean).join(", ");

  const validateStep = (targetStep: Step, options: { fieldsOverride?: FormField[]; leavingStep?: boolean } = {}): boolean => {
    const errs: Record<string, string> = {};
    const targetFields = (options.fieldsOverride || fieldsForStep(targetStep)).filter(isInputField);
    for (const f of targetFields) {
      if (f.required) {
        const val = activeValues[f.id];
        if (!val || (typeof val === "string" && !val.trim()) || (Array.isArray(val) && val.length === 0)) errs[f.id] = `${f.label} is required`;
      }
    }
    if (targetStep === 1 && (options.leavingStep ?? true)) {
      for (const requiredId of ["f1", "f2", "f4", "f5", "f6"]) {
        if (fields.some(f => f.id === requiredId) && !activeValues[requiredId]) errs[requiredId] = "Required";
      }
    }
    if (targetStep === 2 && classChoicesEnabled && !selectedAgeGroup?.noSchedule) {
      const unavailable = requiredSessions.filter(session => session.options.length === 0);
      const missing = requiredSessions.filter(session => session.options.length > 0 && !session.sessionIds.every(sessionId => activeSelectedBySession[sessionId]));
      const selectedCoursesByWeeklySession = requiredSessions
        .map(session => session.sessionIds.map(sessionId => activeSelectedBySession[sessionId]).find(Boolean))
        .filter((courseId): courseId is string => Boolean(courseId));
      const duplicateCourse = selectedCoursesByWeeklySession.find((courseId, index) => selectedCoursesByWeeklySession.indexOf(courseId) !== index);
      if (unavailable.length > 0) errs._form = "One or more sessions has no open classes left. Please contact the program before registering.";
      else if (missing.length > 0) errs._form = "Please choose one class for each session.";
      else if (duplicateCourse) errs._form = "Each class can only be chosen once. Please pick a different class for one of the sessions.";
      else if (missingRequiredClassRules.length > 0) {
        const missingNames = missingRequiredClassRules.map(rule => courseNameById.get(rule.courseId) || "the required class").join(", ");
        errs._form = `This age group must include ${missingNames}. Choose it in any available session before continuing.`;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    const currentPages = pagesForStep(step);
    const currentPage = currentPages[Math.min(sectionPageIndex, currentPages.length - 1)];
    const hasNextPageInStep = sectionPageIndex < currentPages.length - 1;
    if (!validateStep(step, { fieldsOverride: currentPage?.fields, leavingStep: !hasNextPageInStep })) return;
    if (hasNextPageInStep) {
      setSectionPageIndex(prev => prev + 1);
      setErrors({});
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSectionPageIndex(0);
    setStep(prev => (prev === 1 ? (classChoicesEnabled ? 2 : 3) : 3));
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prevStep = () => {
    if (sectionPageIndex > 0) {
      setSectionPageIndex(prev => Math.max(prev - 1, 0));
      setErrors({});
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const previousStep: Step = step === 3 ? (classChoicesEnabled ? 2 : 1) : 1;
    const previousPages = pagesForStep(previousStep);
    setStep(previousStep);
    setSectionPageIndex(Math.max(previousPages.length - 1, 0));
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectCourseForSession = (sessionIds: string[], courseId: string) => {
    const additions = Object.fromEntries(sessionIds.map(sessionId => [sessionId, courseId]));
    if (familyRegistrationEnabled) {
      setStudents(prev => prev.map((student, idx) => idx === activeStudentIndex ? { ...student, selectedBySession: { ...student.selectedBySession, ...additions } } : student));
    } else {
      setSelectedBySession(prev => ({ ...prev, ...additions }));
    }
    if (errors._form) setErrors(prev => { const n = { ...prev }; delete n._form; return n; });
  };

  const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
  const familyCampPriceCents = camperPriceCents * activeStudentCount;
  const priceAfterDiscountCents = Math.max(0, familyCampPriceCents - couponDiscountCents);
  const calculatedPlatformFeeCents = camperPriceCents > 0 ? (priceAfterDiscountCents > 0 ? Math.min(platformFeeCapCents, Math.max(platformFeeMinCents, Math.round(priceAfterDiscountCents * platformFeePercentBps / 10000))) : 0) : platformFeeCents;
  const totalDueCents = billingMode === "camperFee" ? priceAfterDiscountCents + calculatedPlatformFeeCents : 0;

  const applyCoupon = async () => {
    setCouponMsg(null);
    setCouponDiscountCents(0);
    if (!couponCode.trim()) return;
    const res = await fetch(`/api/camps/${campId}/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode, guardianEmail: values.f6 || "", quantity: activeStudentCount }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.valid) {
      setCouponDiscountCents(Number(data.totals?.discountCents || 0));
      setCouponCode(data.coupon?.code || couponCode.toUpperCase());
      setCouponMsg({ type: "success", text: `Coupon applied: ${money(Number(data.totals?.discountCents || 0))} off.` });
    } else {
      setCouponMsg({ type: "error", text: data.error || "Coupon could not be applied." });
    }
  };

  const buildStudentPayload = (student: StudentState) => ({
    firstName: student.values.f1 || "",
    lastName: student.values.f2 || "",
    dateOfBirth: student.values.f3 || undefined,
    ageGroupId: student.values.f4 || undefined,
    emergencyPhone: student.values.f8 || undefined,
    tshirtSize: student.values.f9 || undefined,
    medicalNotes: student.values.f10 || undefined,
    dietaryNotes: student.values.f11 || undefined,
    photoConsent: Boolean(student.values.f12),
    selectedSessionCourseIds: classChoicesEnabled ? student.selectedBySession : {},
    selectedCourseIds: classChoicesEnabled ? [...new Set(Object.values(student.selectedBySession).filter(Boolean))] : [],
    customData: Object.fromEntries(fields.filter(f => !SYSTEM_FIELD_IDS.has(f.id) && isInputField(f)).map(f => [f.label, student.values[f.id] || ""])),
  });

  const addAnotherStudent = () => {
    if (!validateStep(3)) return;
    setCouponDiscountCents(0);
    if (couponCode.trim()) setCouponMsg({ type: "error", text: "Student count changed — reapply the coupon so the family total is recalculated." });
    setStudents(prev => [...prev, makeStudent(prev.length + 1)]);
    setActiveStudentIndex(students.length);
    setStep(1);
    setSectionPageIndex(0);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitRegistration = async (updateExisting = false, existingCamperId?: string) => {
    setSubmitting(true);
    setDuplicate(null);
    try {
      const res = await fetch(`/api/camps/${campId}/public-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(familyRegistrationEnabled ? {
          guardianName: values.f5 || "",
          guardianEmail: values.f6 || "",
          guardianPhone: values.f7 || "",
          campers: students.map(buildStudentPayload),
          formRef,
          couponCode: couponCode.trim() || undefined,
        } : {
          ...buildStudentPayload({ id: "single", values, selectedBySession }),
          guardianName: values.f5 || "",
          guardianEmail: values.f6 || "",
          guardianPhone: values.f7 || "",
          formRef,
          couponCode: couponCode.trim() || undefined,
          updateExisting,
          existingCamperId,
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
        setPaymentNotice("Registration saved. The payment system is not configured yet, so the program will follow up about the platform fee.");
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
    if (familyRegistrationEnabled) {
      const invalidIndex = students.findIndex(student => !student.values.f1 || !student.values.f2 || !student.values.f4);
      if (invalidIndex >= 0) {
        setActiveStudentIndex(invalidIndex);
        setStep(1);
        setSectionPageIndex(0);
        setErrors({ _form: `Student ${invalidIndex + 1} needs first name, last name, and age group before submitting.` });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    await submitRegistration(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const pageStyle = { background: `linear-gradient(135deg, ${appearance.primaryColor}18, ${appearance.accentColor}18)`, fontFamily: `${appearance.fontFamily}, ${appearance.fontFamily === "Georgia" || appearance.fontFamily === "Merriweather" ? "serif" : "sans-serif"}` };
  const brandStyle = { background: `linear-gradient(135deg, ${appearance.primaryColor}, ${appearance.accentColor})` };

  if (!regOpen) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={pageStyle}>
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        <span className="text-5xl mb-4 block">🔒</span>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">{campName}</h1>
        <p className="text-slate-500">Registration is not currently open. Check back later!</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={pageStyle}>
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        <span className="text-6xl mb-4 block">🎉</span>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">{submittedUpdated ? "Registration updated!" : "You're registered!"}</h1>
        <p className="text-slate-500 mb-6">Your registration for <strong>{campName}</strong> has been {submittedUpdated ? "updated" : "submitted"}. Check your email for a confirmation copy.</p>
        <button onClick={() => { setSubmitted(false); setSubmittedUpdated(false); setValues({}); setStudents([makeStudent(1)]); setActiveStudentIndex(0); setSelectedBySession({}); setStep(1); setSectionPageIndex(0); }}
          style={brandStyle} className="px-5 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90">
          Register Another Camper
        </button>
      </div>
    </div>
  );

  const inputCls = (id: string) => `w-full px-4 py-2.5 border rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
    errors[id] ? "border-red-400 focus:ring-red-300" : "border-slate-200 focus:ring-slate-300"
  }`;

  const currentStepPages = pagesForStep(step);
  const currentPageIndex = Math.min(sectionPageIndex, Math.max(currentStepPages.length - 1, 0));
  const currentPage = currentStepPages[currentPageIndex] || { id: "page-1", fields: fieldsForStep(step) };
  const hasMultiplePagesInStep = currentStepPages.length > 1;

  const renderField = (field: FormField) => {
    if (field.type === "heading") return <div key={field.id} className="pt-2"><h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-2">{field.label}</h3></div>;
    if (field.type === "subheading") return (
      <div key={field.id} className="rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3">
        <p className="text-sm font-bold text-sky-900">{field.label}</p>
        {field.helpText && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-sky-800">{field.helpText}</p>}
      </div>
    );
    if (field.type === "pageBreak") return null;
    if (field.type === "divider") return <hr key={field.id} className="border-slate-100" />;
    return (
      <div key={field.id}>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {field.helpText && <p className="text-xs text-slate-400 mb-1.5">{field.helpText}</p>}
        {field.type === "textarea" ? (
          <textarea rows={3} placeholder={field.placeholder} value={(activeValues[field.id] as string) || ""} onChange={e => setValue(field.id, e.target.value)} className={inputCls(field.id) + " resize-none"} />
        ) : field.type === "checkbox" ? (
          field.options?.length ? (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              {field.options.map(option => (
                <label key={option} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Array.isArray(activeValues[field.id]) && (activeValues[field.id] as string[]).includes(option)}
                    onChange={e => toggleCheckboxOption(field.id, option, e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-forest-500"
                  />
                  <span className="text-sm text-slate-700">{option}</span>
                </label>
              ))}
            </div>
          ) : (
            <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <input type="checkbox" checked={Boolean(activeValues[field.id])} onChange={e => setValue(field.id, e.target.checked)} className="w-4 h-4 mt-0.5 accent-forest-500" />
              <span className="text-sm text-slate-700">{field.checkboxDescription || field.label}</span>
            </label>
          )
        ) : field.type === "select" ? (
          <select value={(activeValues[field.id] as string) || ""} onChange={e => setValue(field.id, e.target.value)} className={inputCls(field.id)}>
            <option value="">— select —</option>
            {field.source === "ageGroups" ? ageGroups.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>) : field.options?.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input type={field.type} placeholder={field.placeholder} value={(activeValues[field.id] as string) || ""} onChange={e => setValue(field.id, e.target.value)} className={inputCls(field.id)} />
        )}
        {errors[field.id] && <p className="text-xs text-red-500 mt-1">{errors[field.id]}</p>}
      </div>
    );
  };

  return (
    <div className="min-h-screen py-10 px-4" style={pageStyle}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div style={brandStyle} className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-3xl mx-auto mb-4 shadow-lg">🏕️</div>
          <h1 className="text-3xl font-bold text-slate-800">{campName}</h1>
          <p className="text-slate-500 mt-1">{familyRegistrationEnabled ? "Family Registration" : "Participant Registration"}</p>
        </div>

        <div className="flex items-center gap-2 mb-5">
          {(classChoicesEnabled ? ["Info", "Classes", "Consent"] : ["Info", "Consent"]).map((label, idx) => {
            const num = classChoicesEnabled ? idx + 1 : (idx === 0 ? 1 : 3);
            const active = step === num;
            const done = step > num;
            return <div key={label} style={active ? brandStyle : done ? { backgroundColor: `${appearance.primaryColor}18`, color: appearance.primaryColor } : undefined} className={`flex-1 rounded-full px-3 py-2 text-center text-xs font-bold ${active ? "text-white" : done ? "" : "bg-white text-slate-400 border border-slate-200"}`}>{done ? "✓ " : ""}{label}</div>;
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {paymentNotice && <div className="mb-5 px-4 py-3 bg-forest-50 border border-forest-200 rounded-xl text-sm text-forest-800">{paymentNotice}</div>}
          {billingMode === "camperFee" && (
            <div className="mb-5 px-4 py-4 bg-sky-50 border border-sky-200 rounded-xl text-sm text-sky-900 space-y-3">
              <p><strong>Registration total:</strong> {money(totalDueCents)} {camperPriceCents > 0 ? `(${activeStudentCount} student${activeStudentCount === 1 ? "" : "s"} · program price ${money(familyCampPriceCents)}${couponDiscountCents ? ` − ${money(couponDiscountCents)} coupon` : ""} + ${money(calculatedPlatformFeeCents)} platform fee)` : `(platform fee ${money(platformFeeCents)})`}.</p>
              <div className="flex gap-2">
                <input value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponDiscountCents(0); setCouponMsg(null); }} placeholder="Coupon code" className="flex-1 px-3 py-2 border border-sky-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
                <button type="button" onClick={applyCoupon} className="px-3 py-2 bg-sky-600 text-white rounded-lg text-sm font-bold hover:bg-sky-700">Apply</button>
              </div>
              {couponMsg && <p className={`text-xs font-semibold ${couponMsg.type === "success" ? "text-forest-700" : "text-red-600"}`}>{couponMsg.text}</p>}
            </div>
          )}
          {familyRegistrationEnabled && (
            <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-sky-700 mb-2">Students in this family registration</p>
              <div className="flex flex-wrap gap-2">
                {students.map((student, idx) => (
                  <button key={student.id} type="button" onClick={() => { setActiveStudentIndex(idx); setStep(1); setSectionPageIndex(0); setErrors({}); }} className={`rounded-xl px-3 py-2 text-sm font-bold border ${idx === activeStudentIndex ? "bg-sky-600 text-white border-sky-600" : "bg-white text-sky-800 border-sky-200"}`}>
                    {student.values.f1 || student.values.f2 ? `${student.values.f1 || "Student"} ${student.values.f2 || ""}` : `Student ${idx + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}
          {errors._form && step !== 2 && <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{errors._form}</div>}
          {duplicate && (
            <div className="mb-5 px-4 py-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm font-semibold text-amber-900 mb-1">Possible duplicate registration</p>
              <p className="text-sm text-amber-800 mb-3">{duplicate.message}</p>
              <div className="flex flex-wrap gap-2">
                {!familyRegistrationEnabled && <button type="button" disabled={submitting} onClick={() => submitRegistration(true, duplicate.camperId)} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-60">Update Original Submission</button>}
                <button type="button" onClick={() => setDuplicate(null)} className="px-4 py-2 bg-white border border-amber-200 text-amber-800 rounded-lg text-sm font-semibold hover:bg-amber-100">Go Back & Edit</button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {step === 1 && (
              <>
                <h2 className="text-xl font-bold text-slate-800">{familyRegistrationEnabled ? `Parent + student ${activeStudentIndex + 1} info` : "Parent + student info"}</h2>
                <p className="text-sm text-slate-500">Age Group is required for registration. {classChoicesEnabled ? "The next step will show classroom choices based on the selected age group." : "Class choices are disabled for this form, so families will continue directly to consent."}</p>
                {hasMultiplePagesInStep && <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Page {currentPageIndex + 1} of {currentStepPages.length}{currentPage.title ? ` · ${currentPage.title}` : ""}</p>}
                {currentPage.fields.map(renderField)}
                <button type="button" onClick={nextStep} style={brandStyle} className="w-full py-3.5 text-white rounded-xl text-sm font-bold hover:opacity-90">{currentPageIndex < currentStepPages.length - 1 ? "Continue →" : classChoicesEnabled ? "Continue to Classes →" : "Continue →"}</button>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-xl font-bold text-slate-800">Choose classes {familyRegistrationEnabled ? `for student ${activeStudentIndex + 1}` : "by session"}</h2>
                <p className="text-sm text-slate-500">Pick one class for each session. Full classes are hidden automatically; if seats are added later, they reappear here.</p>
                {selectedAgeGroup?.noSchedule ? (
                  <div className="px-4 py-6 bg-amber-50 border border-amber-200 rounded-xl text-center text-sm text-amber-700">This age group is marked “No Schedule,” so no class choices are required.</div>
                ) : registrationSessions.length === 0 ? (
                  <div className="px-4 py-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm text-slate-500">No class sessions are currently available.</div>
                ) : (
                  <div className="space-y-5">
                    {requiredClassRulesForAgeGroup.length > 0 && (
                      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                        <p className="font-bold">This age group must include {requiredClassNames}. Choose {requiredClassRulesForAgeGroup.length === 1 ? "it" : "them"} in any available session before continuing.</p>
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
                              const checked = session.sessionIds.every(sessionId => activeSelectedBySession[sessionId] === option.courseId);
                              const selectedInAnotherSession = Object.entries(activeSelectedBySession).some(([sessionId, courseId]) => !session.sessionIds.includes(sessionId) && courseId === option.courseId);
                              const unavailableBecauseChosen = selectedInAnotherSession && !checked;
                              return <label key={option.courseId} className={`block border-l-4 p-4 transition-all ${optionCapacityClass(option, checked, unavailableBecauseChosen)}`}>
                                <div className="flex items-start gap-3">
                                  <input type="radio" name={`session-${session.id}`} checked={checked} disabled={unavailableBecauseChosen} onChange={() => selectCourseForSession(session.sessionIds, option.courseId)} className="mt-1 w-4 h-4 accent-forest-500 disabled:accent-slate-300" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                      <p className="font-semibold text-slate-800">{option.name}</p>
                                      <div className="flex flex-wrap justify-end gap-2">
                                        {!unavailableBecauseChosen && option.seatsLeft !== null && (
                                          <span className={`text-xs font-black px-2 py-1 rounded-full whitespace-nowrap ${optionSeatBadgeClass(option, false)}`}>
                                            {optionCapacityLabel(option)}
                                          </span>
                                        )}
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${optionSeatBadgeClass(option, unavailableBecauseChosen)}`}>
                                          {unavailableBecauseChosen ? "Already chosen" : option.seatsLeft === null ? "Open seats" : `${option.seatsLeft} seats left`}
                                        </span>
                                      </div>
                                    </div>
                                    {option.description && <p className="text-sm text-slate-500 mt-0.5">{option.description}</p>}
                                    {!unavailableBecauseChosen && option.seatsLeft !== null && option.cap && option.cap > 0 && (
                                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80 ring-1 ring-black/5">
                                        <div
                                          className={`h-full rounded-full ${optionFillRate(option)! >= 0.9 ? "bg-orange-500" : optionFillRate(option)! >= 0.75 ? "bg-amber-500" : optionFillRate(option)! >= 0.5 ? "bg-sky-500" : "bg-emerald-500"}`}
                                          style={{ width: `${Math.max(optionFillRate(option)! * 100, 6)}%` }}
                                        />
                                      </div>
                                    )}
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
                {errors._form && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700">{errors._form}</div>}
                <div className="flex gap-3">
                  <button type="button" onClick={prevStep} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">← Back</button>
                  <button type="button" onClick={nextStep} style={brandStyle} className="flex-1 py-3 text-white rounded-xl text-sm font-bold hover:opacity-90">Continue →</button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="text-xl font-bold text-slate-800">Consent + emergency info</h2>
                {hasMultiplePagesInStep && <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Page {currentPageIndex + 1} of {currentStepPages.length}{currentPage.title ? ` · ${currentPage.title}` : ""}</p>}
                {currentPage.fields.map(renderField)}
                <div className="flex gap-3">
                  <button type="button" onClick={prevStep} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">← Back</button>
                  {currentPageIndex < currentStepPages.length - 1 ? (
                    <button type="button" onClick={nextStep} style={brandStyle} className="flex-1 py-3 text-white rounded-xl text-sm font-bold hover:opacity-90">Continue →</button>
                  ) : (
                    <>
                      {familyRegistrationEnabled && <button type="button" onClick={addAnotherStudent} className="flex-1 py-3 border border-sky-200 bg-sky-50 text-sky-700 rounded-xl text-sm font-bold hover:bg-sky-100">+ Add Student</button>}
                      <button type="submit" disabled={submitting} style={brandStyle} className="flex-1 py-3 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                        {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</> : billingMode === "camperFee" && totalDueCents > 0 ? `Submit ${activeStudentCount} + Pay ${money(totalDueCents)} →` : `Submit ${familyRegistrationEnabled ? `${activeStudentCount} Student${activeStudentCount === 1 ? "" : "s"}` : "Registration"} →`}
                      </button>
                    </>
                  )}
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
