// Demo mode: a small rule-based translator used when no AI key is configured.
// It handles "total X by Y", "average X per Y", "top 5 ...", "how many ...",
// trends over time and filters on known text values. Anything harder needs the AI.
import type { AskAnswer, ColumnProfile, TableProfile } from "./types";

const q = (id: string) => (/^[a-z_][a-z0-9_]*$/.test(id) ? id : `"${id.replace(/"/g, '""')}"`);
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const human = (id: string) => id.replace(/_/g, " ");

const MONEY = /\b(revenue|sales|money|earn\w*|income|turnover|takings|spend\w*|spent)\b/;
const MONEY_COLS = /^(amount|revenue|sales|total|total_amount|value|price|net|gross)$/i;
const QTY = /\b(sold|sell\w*|units|quantity|qty|volume)\b/;
const QTY_COLS = /^(qty|quantity|units|units_sold|count)$/i;
const TIME = /\b(per|by|each|over|every)\s+(day|week|month|quarter|year)\b|\b(daily|weekly|monthly|quarterly|yearly|annual\w*|over time|trend\w*)\b/;

function has(text: string, phrase: string): boolean {
  const p = words(phrase);
  if (!p) return false;
  return ` ${text} `.includes(` ${p} `) || ` ${text} `.includes(` ${p}s `);
}

function mentions(text: string, col: ColumnProfile): boolean {
  return has(text, col.name) || (col.name.includes("_") && col.name.split("_").every((w) => w.length > 2 && has(text, w)));
}

const idLike = (c: ColumnProfile) => /(^id$|_id$|^id_)/i.test(c.name);

function pickTable(text: string, tables: TableProfile[]): TableProfile {
  let best = tables[0];
  let bestScore = -1;
  for (const t of tables) {
    let score = 0;
    if (has(text, t.name) || t.name.split("_").some((w) => w.length > 3 && has(text, w))) score += 3;
    for (const c of t.columns) {
      if (mentions(text, c)) score += 1;
      if (c.values && c.distinct !== undefined && c.distinct <= c.values.length && c.values.some((v) => has(text, v))) score += 1;
    }
    if (MONEY.test(text) && t.columns.some((c) => MONEY_COLS.test(c.name))) score += 1;
    if (score > bestScore || (score === bestScore && t.rows > best.rows)) [best, bestScore] = [t, score];
  }
  return best;
}

export function translate(question: string, tables: TableProfile[]): AskAnswer {
  const text = words(question);
  const t = pickTable(text, tables);
  const nums = t.columns.filter((c) => c.kind === "number" && !idLike(c));
  const dates = t.columns.filter((c) => c.kind === "date");
  const texts = t.columns.filter((c) => c.kind === "text");

  // Filters: known text values mentioned in the question, e.g. "in Pune", "only UPI".
  const filters: { col: ColumnProfile; values: string[] }[] = [];
  for (const c of texts) {
    if (!c.values || c.distinct === undefined || c.distinct > c.values.length) continue;
    const hit = c.values.filter((v) => v.length > 1 && has(text, v));
    if (hit.length) filters.push({ col: c, values: hit });
  }

  // Grouping: a time bucket, or a column named after "by / per / each / which / what".
  let dimSql: string | null = null;
  let dimName: string | null = null;
  let isTime = false;
  const timeMatch = text.match(TIME);
  const hourCol = t.columns.find((c) => /^hour/.test(c.name));
  if (/\b(hour|hours|hourly|time of day)\b/.test(text) && hourCol) {
    dimSql = q(hourCol.name);
    dimName = hourCol.name;
  } else if (timeMatch && dates.length) {
    const unit = (timeMatch[2] ?? (/daily/.test(text) ? "day" : /weekly/.test(text) ? "week" : /quarter/.test(text) ? "quarter" : /year|annual/.test(text) ? "year" : "month")) as string;
    dimName = unit;
    dimSql = `date_trunc('${unit}', ${q(dates[0].name)})`;
    isTime = true;
  } else {
    const after = text.match(/\b(?:by|per|each|which|what|for every|across|(?:top|bottom|best|worst)\s+\d+)\s+([a-z0-9 ]+)/g) ?? [];
    for (const phrase of after) {
      const rest = phrase.replace(/^(?:for every|(?:top|bottom|best|worst)\s+\d+|\w+)\s+/, "");
      const col = t.columns.find((c) => (c.kind === "text" || c.kind === "number") && !idLike(c) && rest.startsWith(words(c.name)));
      const loose = col ?? t.columns.find((c) => c.kind === "text" && rest.split(" ")[0].replace(/s$/, "") === words(c.name).replace(/s$/, ""));
      if (loose && !filters.some((f) => f.col === loose)) {
        dimSql = q(loose.name);
        dimName = loose.name;
        break;
      }
    }
  }

  // Measure.
  const named = nums.find((c) => mentions(text, c) && c.name !== dimName);
  const money = MONEY.test(text) ? nums.find((c) => MONEY_COLS.test(c.name)) : undefined;
  const qty = QTY.test(text) ? nums.find((c) => QTY_COLS.test(c.name)) : undefined;
  const counting = /\b(how many|number of|count|orders|transactions|rows|records)\b/.test(text);
  const measureCol = named ?? money ?? qty;
  let agg = /\b(average|avg|mean|typical)\b/.test(text)
    ? "avg"
    : /\b(max|maximum|highest|biggest|largest)\b/.test(text) && !dimSql
      ? "max"
      : /\b(min|minimum|lowest|smallest)\b/.test(text) && !dimSql
        ? "min"
        : "sum";
  let measureSql: string | null = null;
  let measureName: string | null = null;
  if (measureCol && !(counting && !named && !money && !qty)) {
    measureSql = agg === "avg" ? `round(avg(${q(measureCol.name)}), 2)` : `${agg}(${q(measureCol.name)})`;
    measureName = `${agg === "sum" ? "total" : agg}_${measureCol.name}`;
  } else if (counting || dimSql || /\b(most|busiest|popular|least)\b/.test(text)) {
    agg = "count";
    measureSql = "count(*)";
    measureName = /\border/.test(text) ? "orders" : "count";
  }

  const where = filters.length
    ? ` WHERE ${filters.map((f) => (f.values.length === 1 ? `${q(f.col.name)} = ${lit(f.values[0])}` : `${q(f.col.name)} IN (${f.values.map(lit).join(", ")})`)).join(" AND ")}`
    : "";
  const filterWords = filters.length ? ` for ${filters.map((f) => f.values.join(" or ")).join(", ")}` : "";

  // Nothing recognisable: show the rows.
  if (!measureSql) {
    return {
      sql: `SELECT * FROM ${q(t.name)}${where} LIMIT 200`,
      title: filters.length ? `Rows${filterWords}` : `A look at ${human(t.name)}`,
      explanation: filters.length
        ? `Demo mode matched a filter but no measure, so here are the matching rows. Add an AI key for full questions.`
        : `Demo mode couldn't work this one out, so here are the first rows of ${t.name}. Add an AI key to ask anything.`,
      chart: { type: "table" },
    };
  }

  const top = text.match(/\b(top|best|bottom|worst|lowest)\s+(\d{1,3})\b/);
  const desc = !top || /top|best/.test(top[1]);

  if (!dimSql) {
    return {
      sql: `SELECT ${measureSql} AS ${measureName} FROM ${q(t.name)}${where}`,
      title: `${human(measureName!)}${filterWords}`.replace(/^\w/, (c) => c.toUpperCase()),
      explanation: `${agg === "count" ? "Counts the rows" : `Takes the ${agg === "sum" ? "sum" : agg} of ${measureCol!.name}`} in ${t.name}${filterWords}.`,
      chart: { type: "number", y: measureName! },
    };
  }

  const dimAlias = isTime ? dimName! : q(dimName!);
  const order = isTime || dimName === hourCol?.name ? `${dimAlias}` : `${measureName} ${desc ? "DESC" : "ASC"}`;
  const limit = top ? ` LIMIT ${top[2]}` : isTime ? "" : " LIMIT 50";
  return {
    sql: `SELECT ${isTime ? `${dimSql} AS ${dimName}` : dimSql}, ${measureSql} AS ${measureName} FROM ${q(t.name)}${where} GROUP BY 1 ORDER BY ${order}${limit}`,
    title: `${human(measureName!)} by ${human(dimName!)}${filterWords}`.replace(/^\w/, (c) => c.toUpperCase()),
    explanation: `Groups ${t.name} by ${isTime ? `${dimName} of ${dates[0].name}` : dimName}${filterWords} and ${agg === "count" ? "counts the rows" : `${agg === "sum" ? "adds up" : `takes the ${agg} of`} ${measureCol!.name}`} in each group.`,
    chart: { type: isTime || dimName === hourCol?.name ? "line" : "bar", x: dimName!, y: measureName! },
  };
}
