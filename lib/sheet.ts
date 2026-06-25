export const SHEET_ID = "1nTNvWJljP0_8ozBY_-bBDygc5s9KS-kf538F-4b6k08";
// Change SHEET_NAME to target a specific tab (e.g. "Sheet1"). Leave null for default first tab.
export const SHEET_NAME: string | null = null;
// Polling interval (ms) — change here to tune auto-refresh cadence.
export const POLL_INTERVAL_MS = 12000;

export const COLUMNS = [
  "FullName",
  "PhoneNumber",
  "MaritalStatus",
  "DateOfBirth",
  "HighestEducation",
  "City",
  "WorkExperienceYears",
  "SpouseInfo",
  "RelativesInCanada",
] as const;

export type ColumnKey = (typeof COLUMNS)[number];
export type Application = Record<ColumnKey, string> & { _id: string; _rowIndex: number };

function buildUrl() {
  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
  return SHEET_NAME ? `${base}&sheet=${encodeURIComponent(SHEET_NAME)}` : base;
}

// Minimal CSV parser supporting quoted fields, escaped quotes, commas and newlines inside quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export async function fetchApplications(): Promise<Application[]> {
  const res = await fetch(buildUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  const text = await res.text();
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  const idx: Record<string, number> = {};
  COLUMNS.forEach((c) => {
    idx[c] = headers.indexOf(c);
  });

  const apps: Application[] = rows.slice(1).map((r, i) => {
    const obj = { _id: "", _rowIndex: i } as Application;
    COLUMNS.forEach((c) => {
      const v = idx[c] >= 0 ? (r[idx[c]] ?? "") : "";
      (obj as Record<string, string | number>)[c] = (v ?? "").toString().trim();
    });
    obj._id = `${i}-${obj.FullName}-${obj.PhoneNumber}-${obj.DateOfBirth}`;
    return obj;
  });

  return apps;
}
