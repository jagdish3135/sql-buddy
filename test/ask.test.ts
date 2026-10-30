import { afterEach, describe, expect, it, vi } from "vitest";
import { ask, status } from "../server/ask";
import { orders, outlets } from "./fixtures";

const body = { question: "Revenue per seat by city", tables: [orders, outlets] };
const env = { LLM_API_KEY: "test-key" };

// Stands in for the AI provider: returns the given answer as the model's message.
function fakeProvider(answer: unknown) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
    Response.json({ choices: [{ message: { content: typeof answer === "string" ? answer : JSON.stringify(answer) } }] }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const promptOf = (fetchMock: ReturnType<typeof fakeProvider>) => JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).messages[1].content as string;

afterEach(() => vi.unstubAllGlobals());

describe("ask", () => {
  it("reports demo mode when no key is set", async () => {
    expect(await ask(body, {})).toEqual({ status: 200, json: { mode: "demo" } });
    expect(status({})).toEqual({ mode: "demo" });
  });

  it("prefers Claude when its key is set and never echoes keys", () => {
    expect(status({ ANTHROPIC_API_KEY: "a", LLM_API_KEY: "b" })).toEqual({ mode: "claude", model: "claude-opus-5-5" });
    expect(JSON.stringify(status({ LLM_API_KEY: "secret" }))).not.toContain("secret");
  });

  it("sends the schema, not the rows, and returns validated SQL", async () => {
    const fetchMock = fakeProvider({
      sql: "SELECT o.city, sum(t.amount) / sum(o.seats) AS revenue_per_seat FROM tapri_orders t JOIN tapri_outlets o USING (outlet) GROUP BY 1;",
      title: "Revenue per seat",
      explanation: "Joins orders to outlets.",
      chart: { type: "bar", x: "city", y: "revenue_per_seat" },
    });
    const { status: code, json } = await ask(body, env);
    expect(code).toBe(200);
    expect(json).toMatchObject({ mode: "openai", model: "mistral-small-latest", chart: { type: "bar" } });
    expect((json as { sql: string }).sql.endsWith(";")).toBe(false);

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.mistral.ai/v1/chat/completions");
    const prompt = promptOf(fetchMock);
    expect(prompt).toContain('Table "tapri_orders" (30600 rows');
    expect(prompt).toContain("seats BIGINT");
    expect(prompt).toContain("Question: Revenue per seat by city");
  });

  it("passes the failed SQL and error back on a retry", async () => {
    const fetchMock = fakeProvider({ sql: "SELECT 1", title: "t", explanation: "e", chart: { type: "table" } });
    await ask({ ...body, failedSql: "SELECT nope FROM t", error: 'Referenced column "nope" not found' }, env);
    const prompt = promptOf(fetchMock);
    expect(prompt).toContain("Your previous SQL failed.");
    expect(prompt).toContain('Referenced column "nope" not found');
  });

  it("refuses SQL that writes", async () => {
    fakeProvider({ sql: "DROP TABLE tapri_orders", title: "t", explanation: "e", chart: { type: "table" } });
    const { status: code, json } = await ask(body, env);
    expect(code).toBe(422);
    expect(json.mode).toBe("error");
  });

  it("handles a malformed AI reply", async () => {
    fakeProvider("not json at all");
    const { status: code, json } = await ask(body, env);
    expect(code).toBe(502);
    expect(json).toEqual({ mode: "error", message: "The AI's answer wasn't valid. Try again." });
  });

  it("asks Claude for structured JSON with refusal fallbacks", async () => {
    const answer = { sql: "SELECT 1 AS one", title: "One", explanation: "A one.", chart: { type: "number", y: "one" } };
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      Response.json({
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: "claude-opus-5-5",
        content: [{ type: "text", text: JSON.stringify(answer) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { status: code, json } = await ask(body, { ANTHROPIC_API_KEY: "sk-test" });
    expect(code).toBe(200);
    expect(json).toMatchObject({ mode: "claude", sql: "SELECT 1 AS one" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/v1/messages");
    const sent = JSON.parse(String(init?.body));
    expect(sent).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", output_config: { effort: "low", format: { type: "json_schema" } } });
    expect(new Headers(init?.headers).get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
  });

  it("rejects a bad request body", async () => {
    expect((await ask({ question: "" }, env)).status).toBe(400);
  });
});
