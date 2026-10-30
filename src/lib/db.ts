// DuckDB running in a Web Worker. Files are read straight from the user's disk
// into the browser; nothing is uploaded.
import * as duckdb from "@duckdb/duckdb-wasm";
import { DataType, type Table } from "apache-arrow";
import mvpWasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import ehWasm from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import type { ColumnKind, ColumnProfile, TableProfile } from "./types";

export interface ResultColumn {
  name: string;
  kind: ColumnKind;
}

export interface QueryResult {
  columns: ResultColumn[];
  rows: Record<string, unknown>[];
  ms: number;
  truncated: boolean;
}

const MAX_ROWS = 2000;

let ready: Promise<duckdb.AsyncDuckDBConnection> | null = null;
let database: duckdb.AsyncDuckDB | null = null;

export function connect(): Promise<duckdb.AsyncDuckDBConnection> {
  ready ??= (async () => {
    const bundle = await duckdb.selectBundle({
      mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
      eh: { mainModule: ehWasm, mainWorker: ehWorker },
    });
    const worker = new Worker(bundle.mainWorker!);
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    await db.open({ query: { castBigIntToDouble: true, castDecimalToDouble: true, castTimestampToDate: true } });
    database = db;
    const conn = await db.connect();
    // Keep queries inside the loaded tables: no network or extension loading.
    await conn.query("SET autoinstall_known_extensions = false");
    await conn.query("SET autoload_known_extensions = false");
    return conn;
  })();
  return ready;
}

export function kindOf(type: string): ColumnKind {
  const t = type.toUpperCase();
  if (/^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|FLOAT|DOUBLE|REAL|DECIMAL)/.test(t)) return "number";
  if (/^(DATE|TIMESTAMP|TIME)/.test(t)) return "date";
  if (t === "BOOLEAN") return "bool";
  if (t === "VARCHAR") return "text";
  return "other";
}

function arrowKind(type: DataType): ColumnKind {
  if (DataType.isInt(type) || DataType.isFloat(type) || DataType.isDecimal(type)) return "number";
  if (DataType.isDate(type) || DataType.isTimestamp(type)) return "date";
  if (DataType.isBool(type)) return "bool";
  if (DataType.isUtf8(type) || DataType.isLargeUtf8(type)) return "text";
  return "other";
}

function plain(value: unknown, kind: ColumnKind): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return Number(value);
  if (kind === "date" && typeof value === "number") return new Date(value);
  if (typeof value === "object" && !(value instanceof Date)) return String(value);
  return value;
}

function toResult(table: Table, ms: number): QueryResult {
  const columns = table.schema.fields.map((f) => ({ name: f.name, kind: arrowKind(f.type) }));
  const rows: Record<string, unknown>[] = [];
  const n = Math.min(table.numRows, MAX_ROWS);
  const vectors = columns.map((_, i) => table.getChildAt(i));
  for (let r = 0; r < n; r++) {
    const row: Record<string, unknown> = {};
    columns.forEach((c, i) => (row[c.name] = plain(vectors[i]?.get(r), c.kind)));
    rows.push(row);
  }
  return { columns, rows, ms, truncated: table.numRows > MAX_ROWS };
}

export async function run(sql: string): Promise<QueryResult> {
  const conn = await connect();
  const t0 = performance.now();
  const table = await conn.query(sql);
  return toResult(table, performance.now() - t0);
}

/** "Sales Q3 (final).csv" -> "sales_q3_final" */
export function tableNameFor(file: string, taken: Set<string>): string {
  let base = file
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!base) base = "table";
  if (/^\d/.test(base)) base = `t_${base}`;
  let name = base;
  for (let i = 2; taken.has(name); i++) name = `${base}_${i}`;
  return name;
}

const quote = (id: string) => `"${id.replace(/"/g, '""')}"`;
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

function reader(file: string): string {
  const ext = file.toLowerCase().split(".").pop();
  if (ext === "parquet") return `read_parquet(${lit(file)})`;
  if (ext === "json" || ext === "ndjson" || ext === "jsonl") return `read_json_auto(${lit(file)})`;
  if (ext === "tsv" || ext === "tab") return `read_csv(${lit(file)}, delim='\t', header=true, sample_size=-1)`;
  return `read_csv(${lit(file)}, header=true, sample_size=-1)`;
}

export const ACCEPTED = [".csv", ".tsv", ".tab", ".txt", ".json", ".jsonl", ".ndjson", ".parquet"];

/** Loads a dropped file or a fetched sample into a new table and profiles it. */
export async function load(source: File | { name: string; text: string }, taken: Set<string>): Promise<TableProfile> {
  const conn = await connect();
  const db = database!;
  const name = tableNameFor(source.name, taken);
  const virtual = `${name}__${Date.now()}.${source.name.split(".").pop() ?? "csv"}`;
  if (source instanceof File) {
    await db.registerFileHandle(virtual, source, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
  } else {
    await db.registerFileText(virtual, source.text);
  }
  await conn.query(`CREATE OR REPLACE TABLE ${quote(name)} AS SELECT * FROM ${reader(virtual)}`);
  await db.dropFile(virtual).catch(() => {});
  return profile(name, source.name);
}

export async function drop(name: string): Promise<void> {
  const conn = await connect();
  await conn.query(`DROP TABLE IF EXISTS ${quote(name)}`);
}

async function profile(name: string, file: string): Promise<TableProfile> {
  const conn = await connect();
  const count = Number((await conn.query(`SELECT count(*) AS n FROM ${quote(name)}`)).getChildAt(0)?.get(0) ?? 0);
  const summary = toResult(await conn.query(`SUMMARIZE ${quote(name)}`), 0).rows;
  const columns: ColumnProfile[] = [];
  for (const s of summary) {
    const col: ColumnProfile = {
      name: String(s.column_name),
      type: String(s.column_type),
      kind: kindOf(String(s.column_type)),
      min: s.min == null ? undefined : String(s.min).slice(0, 60),
      max: s.max == null ? undefined : String(s.max).slice(0, 60),
      distinct: s.approx_unique == null ? undefined : Number(s.approx_unique),
    };
    if (col.kind === "text") {
      const limit = (col.distinct ?? 99) <= 30 ? 30 : 5;
      const sample = await conn.query(
        `SELECT DISTINCT CAST(${quote(col.name)} AS VARCHAR) AS v FROM ${quote(name)} WHERE ${quote(col.name)} IS NOT NULL LIMIT ${limit + 1}`,
      );
      const values = toResult(sample, 0).rows.map((r) => String(r.v).slice(0, 80));
      if (values.length <= limit) col.distinct = values.length;
      col.values = values.slice(0, limit);
    }
    columns.push(col);
  }
  return { name, file, rows: count, columns };
}
