const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function fmtNumber(n: number, short = false): string {
  if (!Number.isFinite(n)) return String(n);
  return short && Math.abs(n) >= 10000 ? compact.format(n) : full.format(n);
}

export function fmtDate(d: Date, unitHint?: string): string {
  const utc = { timeZone: "UTC" } as const;
  const isMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
  if (unitHint === "year") return d.toLocaleDateString(undefined, { ...utc, year: "numeric" });
  if (unitHint === "month" || unitHint === "quarter" || (isMidnight && d.getUTCDate() === 1 && unitHint !== "day" && unitHint !== "week"))
    return d.toLocaleDateString(undefined, { ...utc, month: "short", year: "numeric" });
  if (isMidnight) return d.toLocaleDateString(undefined, { ...utc, day: "numeric", month: "short", year: "2-digit" });
  return d.toLocaleString(undefined, { ...utc, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function fmtValue(v: unknown, short = false): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return fmtNumber(v, short);
  if (v instanceof Date) return fmtDate(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

/** Round axis ticks: 0, 250, 500, ... */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) {
    max = min === 0 ? 1 : min * 1.1;
    min = Math.min(0, min);
  }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) ticks.push(Number(v.toPrecision(12)));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const cell = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map(cell).join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\n");
}
