export type PaperProfileId = "letter" | "legal" | "tabloid" | "a4" | "4x6" | "5x3" | "3x5";
export type PrintSlotType = "text" | "image" | "table" | "qr" | "spacer";
export type SlotSize = "sm" | "md" | "lg";

export interface PaperProfile {
  id: PaperProfileId;
  label: string;
  widthIn: number;
  heightIn: number;
  safeInsetIn: number;
}

export interface PrintSlot {
  id: string;
  type: PrintSlotType;
  fieldKeys: string[];
  region: { x: number; y: number; width: number; height: number };
  maxLines?: number;
  allowHide: boolean;
  sizes: SlotSize[];
}

export interface PrintLayoutTemplate {
  id: string;
  name: string;
  paperProfileId: PaperProfileId;
  slots: PrintSlot[];
}

export const PAPER_PROFILES: Record<PaperProfileId, PaperProfile> = {
  letter: { id: "letter", label: "Letter 8.5×11", widthIn: 8.5, heightIn: 11, safeInsetIn: 0.5 },
  legal: { id: "legal", label: "Legal 8.5×14", widthIn: 8.5, heightIn: 14, safeInsetIn: 0.5 },
  tabloid: { id: "tabloid", label: "Tabloid 11×17", widthIn: 11, heightIn: 17, safeInsetIn: 0.5 },
  a4: { id: "a4", label: "A4", widthIn: 8.27, heightIn: 11.69, safeInsetIn: 0.5 },
  "4x6": { id: "4x6", label: "4×6 Card", widthIn: 4, heightIn: 6, safeInsetIn: 0.2 },
  "5x3": { id: "5x3", label: "5×3 Badge", widthIn: 5, heightIn: 3, safeInsetIn: 0.16 },
  "3x5": { id: "3x5", label: "3×5 Lanyard", widthIn: 3, heightIn: 5, safeInsetIn: 0.16 },
};

const text = (id: string, fieldKeys: string[], region: PrintSlot["region"], sizes: SlotSize[] = ["sm", "md", "lg"]): PrintSlot => ({ id, type: "text", fieldKeys, region, maxLines: 3, allowHide: true, sizes });

// Fixed, print-safe recipes for the five everyday documents. Slots never move or overlap;
// only compatible data, visibility, and the approved size variants can change.
export const CORE_PRINT_LAYOUTS: Record<string, PrintLayoutTemplate> = {
  "name-badges": { id: "name-badges", name: "Name Badges", paperProfileId: "letter", slots: [text("name", ["firstName", "fullName"], { x: 8, y: 14, width: 84, height: 28 }), text("age-group", ["ageGroup"], { x: 8, y: 46, width: 54, height: 12 }, ["sm", "md"]), { id: "qr", type: "qr", fieldKeys: ["scanCode"], region: { x: 68, y: 44, width: 24, height: 34 }, allowHide: true, sizes: ["sm", "md"] }] },
  roster: { id: "roster", name: "Roster", paperProfileId: "letter", slots: [text("title", ["activityName", "timeBlock"], { x: 6, y: 5, width: 88, height: 8 }), { id: "rows", type: "table", fieldKeys: ["fullName", "ageGroup", "guardianName", "attendance"], region: { x: 6, y: 16, width: 88, height: 76 }, allowHide: false, sizes: ["sm", "md"] }] },
  "emergency-cards": { id: "emergency-cards", name: "Emergency Contact Cards", paperProfileId: "4x6", slots: [text("name", ["fullName"], { x: 8, y: 10, width: 84, height: 16 }), text("contacts", ["guardianName", "guardianPhone", "emergencyPhone"], { x: 8, y: 30, width: 84, height: 32 }), text("care", ["medicalNotes", "dietaryNotes"], { x: 8, y: 66, width: 84, height: 20 }, ["sm", "md"]) ] },
  "teacher-list": { id: "teacher-list", name: "Teacher List", paperProfileId: "letter", slots: [text("title", ["programName"], { x: 6, y: 5, width: 88, height: 8 }), { id: "rows", type: "table", fieldKeys: ["fullName", "role", "email", "phone", "schedule"], region: { x: 6, y: 16, width: 88, height: 76 }, allowHide: false, sizes: ["sm", "md"] }] },
  "classroom-list": { id: "classroom-list", name: "Classroom List", paperProfileId: "letter", slots: [text("title", ["roomName", "timeBlock"], { x: 6, y: 5, width: 88, height: 8 }), { id: "rows", type: "table", fieldKeys: ["fullName", "activityName", "teacherName"], region: { x: 6, y: 16, width: 88, height: 76 }, allowHide: false, sizes: ["sm", "md"] }] },
};
