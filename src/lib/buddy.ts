// Asks the server for SQL (or falls back to demo mode), runs it in DuckDB,
// and retries once with the error if the AI's SQL doesn't run.
import { run, type QueryResult } from "./db";
import { translate } from "./demo";
import { isReadOnly } from "./guard";
import type { AskAnswer, AskRequest, AskResponse, TableProfile, Turn } from "./types";

export type Mode = "claude" | "openai" | "demo";

export interface Answer extends AskAnswer {
  id: number;
  question: string;
  mode: Mode;
  model?: string;
  result?: QueryResult;
  error?: string;
  edited?: boolean;
  at: Date;
}

let nextId = 1;

async function callServer(body: AskRequest): Promise<AskResponse> {
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("json")) return { mode: "demo" }; // static hosting with no API route
    return (await res.json()) as AskResponse;
  } catch {
    return { mode: "demo" };
  }
}

export async function askBuddy(question: string, tables: TableProfile[], history: Turn[]): Promise<Answer> {
  const base = { id: nextId++, question, at: new Date() };
  const request: AskRequest = { question, tables, history: history.slice(-3) };
  const reply = await callServer(request);

  if (reply.mode === "error") {
    return { ...base, mode: "demo", sql: "", title: "Buddy got stuck", explanation: "", chart: { type: "table" }, error: reply.message };
  }

  if (reply.mode === "demo") {
    const guess = translate(question, tables);
    const answer: Answer = { ...base, ...guess, mode: "demo" };
    try {
      answer.result = await run(guess.sql);
    } catch (err) {
      answer.error = (err as Error).message;
    }
    return answer;
  }

  let answer: Answer = { ...base, ...reply, mode: reply.mode };
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!isReadOnly(answer.sql)) {
      answer.error = "Buddy only runs queries that read your tables, and this one didn't. Try rephrasing.";
      return answer;
    }
    try {
      answer.result = await run(answer.sql);
      answer.error = undefined;
      return answer;
    } catch (err) {
      answer.error = (err as Error).message;
      if (attempt === 1) break;
      const fix = await callServer({ ...request, failedSql: answer.sql, error: answer.error });
      if (fix.mode !== "claude" && fix.mode !== "openai") break;
      answer = { ...answer, ...fix, mode: fix.mode };
    }
  }
  return answer;
}

export async function rerun(answer: Answer, sql: string): Promise<Answer> {
  const next: Answer = { ...answer, sql, edited: true, result: undefined, error: undefined };
  try {
    next.result = await run(sql);
  } catch (err) {
    next.error = (err as Error).message;
  }
  return next;
}
