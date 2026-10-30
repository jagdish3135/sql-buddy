// Shapes shared by the browser app and the /api/ask server route.

export type ColumnKind = "number" | "text" | "date" | "bool" | "other";

export interface ColumnProfile {
  name: string;
  type: string; // DuckDB type, e.g. BIGINT, VARCHAR, DATE
  kind: ColumnKind;
  min?: string;
  max?: string;
  distinct?: number;
  /** A few example values; for low-cardinality text, all of them. */
  values?: string[];
}

export interface TableProfile {
  name: string;
  file: string;
  rows: number;
  columns: ColumnProfile[];
}

export type ChartType = "bar" | "line" | "scatter" | "number" | "table";

export interface ChartHint {
  type: ChartType;
  x?: string;
  y?: string;
}

export interface Turn {
  question: string;
  sql: string;
}

export interface AskRequest {
  question: string;
  tables: TableProfile[];
  /** Last few answered questions, so follow-ups like "now only Pune" work. */
  history?: Turn[];
  /** Set when retrying after the previous SQL failed to run. */
  failedSql?: string;
  error?: string;
}

export interface AskAnswer {
  sql: string;
  title: string;
  explanation: string;
  chart: ChartHint;
}

export type AskResponse =
  | ({ mode: "claude" | "openai"; model: string } & AskAnswer)
  | { mode: "demo" }
  | { mode: "error"; message: string };
