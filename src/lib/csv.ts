import Papa from "papaparse";

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: (keyof T)[]): string {
  const data = rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) out[String(c)] = r[c] ?? "";
    return out;
  });
  return Papa.unparse(data, { columns: columns.map(String) });
}

export function fromCsv<T = Record<string, string>>(text: string): T[] {
  const res = Papa.parse<T>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return res.data;
}

export function csvResponse(body: string, filename: string): Response {
  return new Response("\uFEFF" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
