// Turns a plain-English question into DuckDB SQL. Used by api/ask.ts on Vercel
// and by the Vite dev server. Only the table profiles (column names, types and a
// few example values) reach the AI provider, never the rows themselves.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AskAnswer, AskResponse } from "../src/lib/types.js";
import { isReadOnly } from "../src/lib/guard.js";

export type Env = Record<string, string | undefined>;

const Column = z.object({
  name: z.string().max(200),
  type: z.string().max(80),
  kind: z.enum(["number", "text", "date", "bool", "other"]),
  min: z.string().max(200).optional(),
  max: z.string().max(200).optional(),
  distinct: z.number().optional(),
  values: z.array(z.string().max(120)).max(40).optional(),
});

const Request = z.object({
  question: z.string().trim().min(1).max(600),
  tables: z
    .array(z.object({ name: z.string().max(120), file: z.string().max(200), rows: z.number(), columns: z.array(Column).max(200) }))
    .min(1)
    .max(12),
  history: z.array(z.object({ question: z.string().max(600), sql: z.string().max(6000) })).max(4).optional(),
  failedSql: z.string().max(6000).optional(),
  error: z.string().max(1500).optional(),
});

const Answer = z.object({
  sql: z.string().min(1),
  title: z.string(),
  explanation: z.string(),
  chart: z.object({
    type: z.enum(["bar", "line", "scatter", "number", "table"]),
    x: z.string().optional(),
    y: z.string().optional(),
  }),
});

// Plain JSON schema for the providers' structured-output modes.
const answerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sql", "title", "explanation", "chart"],
  properties: {
    sql: { type: "string", description: "One DuckDB SELECT (or WITH ... SELECT) statement. No trailing semicolon." },
    title: { type: "string", description: "Short headline for the answer, max 8 words." },
    explanation: { type: "string", description: "One or two plain-English sentences on how the query answers the question." },
    chart: {
      type: "object",
      additionalProperties: false,
      required: ["type"],
      properties: {
        type: { type: "string", enum: ["bar", "line", "scatter", "number", "table"] },
        x: { type: "string", description: "Result column for the x axis or categories." },
        y: { type: "string", description: "Result column for the measured value." },
      },
    },
  },
} as const;

const SYSTEM = `You are SQL Buddy. You turn questions about the user's spreadsheets into one DuckDB SQL query.

Rules:
- Write a single read-only SELECT (CTEs with WITH are fine). Never write INSERT, UPDATE, DELETE, CREATE, COPY, ATTACH, INSTALL, LOAD, PRAGMA or SET, and never read files or URLs.
- Use only the tables and columns listed. Quote identifiers with double quotes when they have spaces, capitals or symbols.
- Use DuckDB functions: date_trunc('month', col), strftime(col, '%Y-%m'), extract, round(x, 2), count(*), etc.
- Give computed columns short readable snake_case aliases, like total_revenue or orders.
- Sort results in a useful order. For lists of rows, add LIMIT 200 unless the user asks for everything.
- For time trends, group by a truncated date and order by it ascending.
- Join tables when the question needs columns from more than one; match on columns that share meaning.
- If the question is a follow-up, build on the previous query.
- If the question cannot be answered from the data, still return a query that shows the closest relevant data and say so in the explanation.

Chart: pick "number" for a single value, "line" for a trend over time, "bar" for comparing categories, "scatter" for two numeric measures, otherwise "table". Set x and y to result column names.`;

function describe(req: z.infer<typeof Request>): string {
  const tables = req.tables
    .map((t) => {
      const cols = t.columns
        .map((c) => {
          const bits = [`${c.name} ${c.type}`];
          if (c.min !== undefined && c.max !== undefined && c.kind !== "text") bits.push(`range ${c.min} .. ${c.max}`);
          if (c.values?.length) bits.push(`${c.distinct !== undefined && c.distinct <= c.values.length ? "values" : "e.g."} ${c.values.map((v) => JSON.stringify(v)).join(", ")}`);
          return `  - ${bits.join("; ")}`;
        })
        .join("\n");
      return `Table "${t.name}" (${t.rows} rows, from ${t.file}):\n${cols}`;
    })
    .join("\n\n");

  const parts = [`Tables:\n${tables}`];
  if (req.history?.length) {
    parts.push(`Earlier in this session:\n${req.history.map((h) => `Q: ${h.question}\nSQL: ${h.sql}`).join("\n\n")}`);
  }
  parts.push(`Question: ${req.question}`);
  if (req.failedSql) {
    parts.push(`Your previous SQL failed.\nSQL: ${req.failedSql}\nDuckDB error: ${req.error ?? "unknown"}\nFix the query.`);
  }
  return parts.join("\n\n");
}

async function askClaude(prompt: string, env: Env): Promise<{ answer: unknown; model: string }> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const model = env.CLAUDE_MODEL || "claude-opus-5-5";
  const effort = (env.CLAUDE_EFFORT || "low") as "low" | "medium" | "high";
  const response = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort, format: { type: "json_schema", schema: answerSchema } },
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined this question.");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return { answer: JSON.parse(text), model: response.model };
}

async function askOpenAICompatible(prompt: string, env: Env): Promise<{ answer: unknown; model: string }> {
  const base = (env.LLM_BASE_URL || "https://api.mistral.ai/v1").replace(/\/$/, "");
  const model = env.LLM_MODEL || "mistral-small-latest";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.LLM_API_KEY}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${SYSTEM}\n\nReply with only a JSON object matching this schema:\n${JSON.stringify(answerSchema)}` },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI provider returned ${res.status}${res.status === 429 ? " (rate limited, try again in a minute)" : ""}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  return { answer: JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")), model };
}

export function providerOf(env: Env): "claude" | "openai" | "demo" {
  if (env.ANTHROPIC_API_KEY) return "claude";
  if (env.LLM_API_KEY) return "openai";
  return "demo";
}

/** Which provider is configured, for the badge in the header. Never includes the key. */
export function status(env: Env): { mode: "claude" | "openai" | "demo"; model?: string } {
  const mode = providerOf(env);
  if (mode === "claude") return { mode, model: env.CLAUDE_MODEL || "claude-opus-5-5" };
  if (mode === "openai") return { mode, model: env.LLM_MODEL || "mistral-small-latest" };
  return { mode };
}

export async function ask(body: unknown, env: Env): Promise<{ status: number; json: AskResponse }> {
  const mode = providerOf(env);
  if (mode === "demo") return { status: 200, json: { mode: "demo" } };

  const parsed = Request.safeParse(body);
  if (!parsed.success) return { status: 400, json: { mode: "error", message: "That request didn't look right." } };

  try {
    const prompt = describe(parsed.data);
    const { answer, model } = mode === "claude" ? await askClaude(prompt, env) : await askOpenAICompatible(prompt, env);
    const result: AskAnswer = Answer.parse(answer);
    result.sql = result.sql.trim().replace(/;\s*$/, "");
    if (!isReadOnly(result.sql)) {
      return { status: 422, json: { mode: "error", message: "The AI wrote a query that changes data, so SQL Buddy didn't run it. Try rephrasing." } };
    }
    return { status: 200, json: { mode, model, ...result } };
  } catch (err) {
    let message = "Couldn't reach the AI. Try again.";
    if (err instanceof Anthropic.AuthenticationError) message = "The Claude API key was rejected.";
    else if (err instanceof Anthropic.RateLimitError) message = "Claude is rate limited right now. Try again in a minute.";
    else if (err instanceof Anthropic.APIError) message = `Claude API error ${err.status ?? ""}`.trim();
    else if (err instanceof SyntaxError || err instanceof z.ZodError) message = "The AI's answer wasn't valid. Try again.";
    else if (err instanceof Error) message = err.message;
    return { status: 502, json: { mode: "error", message } };
  }
}
