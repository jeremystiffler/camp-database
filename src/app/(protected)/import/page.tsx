"use client";

import { useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import * as XLSX from "xlsx";

const TEMPLATE_HEADERS = [
  "activity_name","activity_description","activity_capacity",
  "room_name","age_group_name",
  "teacher_first_name","teacher_last_name","teacher_email","teacher_role",
  "assistant_first_name","assistant_last_name","assistant_email",
  "session_label","session_day","session_start_time","session_end_time",
];

const EXAMPLE_ROW = [
  "Watercolor Painting","Learn basic watercolor techniques","15",
  "Art Room","Elementary",
  "Jane","Smith","jane@camp.com","teacher",
  "Bob","Jones","bob@camp.com",
  "Morning Session","Mon","9:00 AM","10:00 AM",
];

const COLUMN_NOTES: Record<string, string> = {
  activity_name: "Required. Must be unique per camp.",
  activity_capacity: "Number e.g. 20",
  teacher_role: "teacher, assistant, director, or staff",
  session_day: "Mon, Tue, Wed, Thu, Fri, Sat, Sun — or 0-6",
  session_start_time: "e.g. 9:00 AM or 09:00",
  session_end_time: "e.g. 10:00 AM or 10:00",
};

interface ImportResult {
  coursesCreated: number;
  coursesUpdated: number;
  teachersCreated: number;
  roomsCreated: number;
  slotsCreated: number;
  ageGroupsCreated: number;
  errors: string[];
  total: number;
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, EXAMPLE_ROW]);
  ws["!cols"] = TEMPLATE_HEADERS.map(h => ({ wch: Math.max(h.length + 2, 18) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Camp Import");
  // Use write→Blob→anchor instead of writeFile (writeFile uses Node fs, breaks in browser)
  const buf  = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "camp-import-template.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ImportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const campId = searchParams.get("campId") || "";
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows]             = useState<Record<string, string>[]>([]);
  const [fileName, setFileName]     = useState("");
  const [importing, setImporting]   = useState(false);
  const [result, setResult]         = useState<ImportResult | null>(null);
  const [dragOver, setDragOver]     = useState(false);
  const [parseError, setParseError] = useState("");

  const validRows   = rows.filter(r => r.activity_name?.trim());
  const invalidRows = rows.filter(r => !r.activity_name?.trim());

  const parseFile = (file: File) => {
    setParseError(""); setResult(null); setRows([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const raw  = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
        if (raw.length < 2) { setParseError("File appears empty or has only a header row."); return; }
        const headers = raw[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, "_"));
        const parsed  = raw.slice(1)
          .filter(row => row.some(cell => String(cell).trim() !== ""))
          .map(row => {
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => { obj[h] = String(row[i] ?? "").trim(); });
            return obj;
          });
        setRows(parsed);
        setFileName(file.name);
      } catch {
        setParseError("Could not parse file. Make sure it's a valid .xlsx, .xls, or .csv file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const runImport = async () => {
    if (!campId || validRows.length === 0) return;
    setImporting(true);
    try {
      const res  = await fetch(`/api/camps/${campId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows }),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else setParseError(data.error || "Import failed");
    } catch { setParseError("Network error during import"); }
    finally { setImporting(false); }
  };

  const reset = () => { setRows([]); setFileName(""); setResult(null); setParseError(""); if (fileRef.current) fileRef.current.value = ""; };

  if (!campId) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center"><span className="text-4xl mb-3 block">📥</span><p>Select a camp to import data.</p></div>
    </div>
  );

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-800">Import (Beta)</h1>
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full">BETA</span>
          </div>
          <p className="text-slate-500 text-sm">Upload a spreadsheet to bulk-create activities, teachers, rooms, and time slots.</p>
        </div>
        <button onClick={downloadTemplate}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-sm flex-shrink-0">
          ⬇️ Download Template
        </button>
      </div>

      {/* Beta warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 flex items-start gap-3">
        <span className="text-xl flex-shrink-0">⚠️</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">Beta Feature</p>
          <p className="text-xs text-amber-700 mt-0.5">Review your data carefully after import. Rows with a matching activity name will <strong>update</strong> the existing activity — they won't create duplicates. Scheduling conflict checks are bypassed during bulk import.</p>
        </div>
      </div>

      {/* Column guide */}
      <div className="camp-card p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Column Reference</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 pr-4 text-slate-500 font-semibold whitespace-nowrap">Column</th>
                <th className="text-left py-2 pr-4 text-slate-500 font-semibold">Notes</th>
                <th className="text-left py-2 text-slate-500 font-semibold">Example</th>
              </tr>
            </thead>
            <tbody>
              {TEMPLATE_HEADERS.map((h, i) => (
                <tr key={h} className={i % 2 === 0 ? "bg-slate-50/50" : ""}>
                  <td className="py-1.5 pr-4 font-mono text-forest-700 whitespace-nowrap">{h}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{COLUMN_NOTES[h] || (h.endsWith("_name") ? "Text" : "Text")}</td>
                  <td className="py-1.5 text-slate-400">{EXAMPLE_ROW[i] || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload area */}
      {!result && (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all mb-6 ${
              dragOver ? "border-forest-400 bg-forest-50" : "border-slate-200 hover:border-forest-300 hover:bg-slate-50"
            }`}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
            <span className="text-5xl mb-3 block">📂</span>
            <p className="text-sm font-semibold text-slate-700 mb-1">Drop your file here or click to browse</p>
            <p className="text-xs text-slate-400">Supports .xlsx, .xls, .csv — use the template above for best results</p>
            {fileName && <p className="text-xs text-forest-600 font-semibold mt-2">📄 {fileName}</p>}
          </div>

          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-5 text-sm text-red-700">{parseError}</div>
          )}

          {/* Preview */}
          {rows.length > 0 && (
            <div className="camp-card overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-700">Preview — {rows.length} row{rows.length !== 1 ? "s" : ""} parsed</h2>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-xs text-forest-600">✅ {validRows.length} valid</span>
                    {invalidRows.length > 0 && <span className="text-xs text-red-500">⚠️ {invalidRows.length} missing activity_name (will be skipped)</span>}
                  </div>
                </div>
                <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600">✕ Clear</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-2 text-left text-slate-400 font-semibold">#</th>
                      {TEMPLATE_HEADERS.map(h => (
                        <th key={h} className="px-3 py-2 text-left text-slate-500 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((row, i) => {
                      const isInvalid = !row.activity_name?.trim();
                      return (
                        <tr key={i} className={`border-b border-slate-50 ${isInvalid ? "bg-red-50" : i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                          <td className={`px-3 py-1.5 font-mono ${isInvalid ? "text-red-400" : "text-slate-300"}`}>{i + 2}</td>
                          {TEMPLATE_HEADERS.map(h => (
                            <td key={h} className={`px-3 py-1.5 whitespace-nowrap max-w-[140px] truncate ${isInvalid && h === "activity_name" ? "text-red-500 font-semibold" : "text-slate-600"}`}>
                              {row[h] || <span className="text-slate-200">—</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {rows.length > 50 && (
                  <p className="px-4 py-3 text-xs text-slate-400 border-t border-slate-100">
                    Showing first 50 of {rows.length} rows. All {rows.length} will be imported.
                  </p>
                )}
              </div>
            </div>
          )}

          {validRows.length > 0 && (
            <div className="flex items-center gap-3">
              <button onClick={runImport} disabled={importing || !campId}
                className="px-5 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center gap-2">
                {importing
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing {validRows.length} rows…</>
                  : <>📥 Import {validRows.length} row{validRows.length !== 1 ? "s" : ""}</>}
              </button>
              <span className="text-xs text-slate-400">{invalidRows.length > 0 ? `(${invalidRows.length} rows without activity_name will be skipped)` : ""}</span>
            </div>
          )}
        </>
      )}

      {/* Results */}
      {result && (
        <div className="camp-card p-6 space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎉</span>
            <div>
              <h2 className="font-bold text-lg text-slate-800">Import Complete</h2>
              <p className="text-sm text-slate-500">{result.total} rows processed</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { icon: "✅", label: "Activities created",  val: result.coursesCreated,  color: "forest" },
              { icon: "🔄", label: "Activities updated",  val: result.coursesUpdated,  color: "sky" },
              { icon: "👤", label: "People added",        val: result.teachersCreated, color: "berry" },
              { icon: "📍", label: "Rooms created",       val: result.roomsCreated,    color: "sunset" },
              { icon: "⏰", label: "Time slots created",  val: result.slotsCreated,    color: "amber" },
              { icon: "🏷️", label: "Age groups created", val: result.ageGroupsCreated,color: "sky" },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-slate-800">{s.val}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.icon} {s.label}</p>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 mb-2">⚠️ {result.errors.length} row{result.errors.length !== 1 ? "s" : ""} had errors:</p>
              <ul className="space-y-1">
                {result.errors.map((e, i) => <li key={i} className="text-xs text-red-600">• {e}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button onClick={reset}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
              Import Another File
            </button>
            <button onClick={() => router.push(`/activities?campId=${campId}`)}
              className="px-4 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
              → Go to Activities
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <ImportContent />
    </Suspense>
  );
}
