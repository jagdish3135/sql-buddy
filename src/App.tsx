import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnswerCard, PendingCard } from "./components/AnswerCard";
import { Buddy } from "./components/Buddy";
import { Cursor } from "./components/Cursor";
import { Landing } from "./components/Landing";
import { TablesRail } from "./components/TablesRail";
import { askBuddy, rerun, type Answer, type Mode } from "./lib/buddy";
import { ACCEPTED, connect, drop, load } from "./lib/db";
import type { TableProfile } from "./lib/types";

const SAMPLES = ["tapri_orders.csv", "tapri_outlets.csv"];

const SAMPLE_QUESTIONS: { q: string; ai?: boolean }[] = [
  { q: "Revenue by month" },
  { q: "Which outlet sold the most chai?" },
  { q: "Busiest hour of the day" },
  { q: "Top 5 items by revenue" },
  { q: "Average amount by payment" },
  { q: "Revenue per seat for each city", ai: true },
  { q: "Did cold drinks sell more in summer than in the monsoon?", ai: true },
  { q: "Which manager's outlet grew fastest this year?", ai: true },
];

function suggestionsFor(tables: TableProfile[], mode: Mode): string[] {
  if (tables.some((t) => t.name === "tapri_orders")) {
    return SAMPLE_QUESTIONS.filter((s) => !s.ai || mode !== "demo").map((s) => s.q);
  }
  const out: string[] = [];
  for (const t of tables.slice(0, 2)) {
    const num = t.columns.find((c) => c.kind === "number" && !/(^id$|_id$)/i.test(c.name));
    const cat = t.columns.find((c) => c.kind === "text" && c.distinct !== undefined && c.distinct > 1 && c.distinct <= 40);
    const date = t.columns.find((c) => c.kind === "date");
    const n = (s: string) => s.replace(/_/g, " ");
    out.push(`How many rows are in ${t.name}?`);
    if (num && cat) out.push(`Total ${n(num.name)} by ${n(cat.name)}`, `Top 5 ${n(cat.name)} by ${n(num.name)}`);
    if (num && date) out.push(`${n(num.name)} by month`.replace(/^\w/, (c) => c.toUpperCase()));
    if (num && cat) out.push(`Average ${n(num.name)} per ${n(cat.name)}`);
  }
  return out.slice(0, 6);
}

const STAGES = ["Reading your columns…", "Writing the SQL…", "Running it in your browser…"];

export default function App() {
  const [tables, setTables] = useState<TableProfile[]>([]);
  const [loading, setLoading] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [pending, setPending] = useState<{ question: string; stage: number } | null>(null);
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<{ mode: Mode; model?: string } | null>(null);
  const [engine, setEngine] = useState<"booting" | "ready" | "failed">("booting");
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const tablesRef = useRef(tables);
  tablesRef.current = tables;

  useEffect(() => {
    connect().then(
      () => setEngine("ready"),
      () => setEngine("failed"),
    );
    fetch("/api/ask")
      .then((r) => (r.headers.get("content-type")?.includes("json") ? r.json() : { mode: "demo" }))
      .then(setMode, () => setMode({ mode: "demo" }));
  }, []);

  const addFiles = useCallback(async (files: (File | { name: string; text: string })[]) => {
    const ok = files.filter((f) => ACCEPTED.some((ext) => f.name.toLowerCase().endsWith(ext)));
    const skipped = files.length - ok.length;
    if (skipped) setNotice(`Skipped ${skipped} file${skipped > 1 ? "s" : ""}. SQL Buddy reads CSV, TSV, JSON and Parquet.`);
    setLoading((l) => [...l, ...ok.map((f) => f.name)]);
    for (const f of ok) {
      try {
        const taken = new Set(tablesRef.current.map((t) => t.name));
        const profile = await load(f, taken);
        setTables((ts) => [...ts.filter((t) => t.name !== profile.name), profile]);
      } catch (err) {
        setNotice(`Couldn't read ${f.name}: ${(err as Error).message.split("\n")[0]}`);
      } finally {
        setLoading((l) => l.filter((n) => n !== f.name));
      }
    }
    input.current?.focus();
  }, []);

  const loadSamples = useCallback(async () => {
    const files = await Promise.all(SAMPLES.map(async (name) => ({ name, text: await (await fetch(`/samples/${name}`)).text() })));
    await addFiles(files);
  }, [addFiles]);

  // Drop files anywhere on the page.
  useEffect(() => {
    let depth = 0;
    const isFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!isFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => isFiles(e) && e.preventDefault();
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!isFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      addFiles(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles]);

  const submit = async (text = question) => {
    const q = text.trim();
    if (!q || pending || !tables.length) return;
    setQuestion("");
    setNotice(null);
    setPending({ question: q, stage: 0 });
    const timer = window.setInterval(() => setPending((p) => (p ? { ...p, stage: Math.min(p.stage + 1, STAGES.length - 1) } : p)), 900);
    const history = answers
      .filter((a) => a.result && !a.error)
      .slice(0, 3)
      .reverse()
      .map((a) => ({ question: a.question, sql: a.sql }));
    try {
      const answer = await askBuddy(q, tables, history);
      setAnswers((as) => [answer, ...as]);
    } finally {
      window.clearInterval(timer);
      setPending(null);
    }
  };

  const removeTable = async (name: string) => {
    await drop(name);
    setTables((ts) => ts.filter((t) => t.name !== name));
  };

  const insert = (text: string) => {
    const el = input.current;
    const word = /^[a-z_][a-z0-9_]*$/.test(text) ? text : `"${text}"`;
    setQuestion((q) => (q && !q.endsWith(" ") ? `${q} ${word} ` : `${q}${word} `));
    el?.focus();
  };

  const suggestions = useMemo(() => suggestionsFor(tables, mode?.mode ?? "demo"), [tables, mode]);
  const hasData = tables.length > 0;

  return (
    <div className={`app${hasData ? " has-data" : ""}`}>
      <div className="grain" aria-hidden="true" />
      <Cursor />
      <header className="mast">
        <div className="mast-brand">
          <Buddy size={46} thinking={!!pending} />
          <div>
            <h1 className="wordmark" data-text="SQL Buddy">
              SQL Buddy
            </h1>
            <p className="tagline">Ask your spreadsheets anything. It writes the SQL.</p>
          </div>
        </div>
        <div className="mast-side">
          {mode && (
            <span className={`badge badge-${mode.mode}`} title={mode.model}>
              {mode.mode === "claude" ? `✦ Claude · ${mode.model}` : mode.mode === "openai" ? `✦ ${mode.model}` : "Demo mode · no AI key"}
            </span>
          )}
          <span className={`badge badge-engine engine-${engine}`}>
            {engine === "booting" ? "warming up DuckDB…" : engine === "ready" ? "DuckDB ready · runs in this tab" : "DuckDB failed to start"}
          </span>
        </div>
      </header>

      <input
        ref={picker}
        type="file"
        multiple
        accept={ACCEPTED.join(",")}
        hidden
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {!hasData && loading.length === 0 ? (
        <Landing onChoose={() => picker.current?.click()} onSamples={loadSamples} disabled={engine === "failed"} />
      ) : (
        <div className="workspace">
          <TablesRail tables={tables} loading={loading} onRemove={removeTable} onPickColumn={insert} onAddFiles={() => picker.current?.click()} />
          <main className="desk">
            <form
              className="askbar"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <label htmlFor="q" className="askbar-label">
                Ask about {tables.length === 1 ? tables[0].name : `${tables.length || ""} tables`}
              </label>
              <div className="askbar-row">
                <textarea
                  id="q"
                  ref={input}
                  rows={2}
                  value={question}
                  placeholder={answers.length ? "Ask a follow-up, like “now only for UPI”…" : "e.g. Which outlet sold the most chai?"}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  maxLength={600}
                />
                <button type="submit" className="btn btn-ink ask-go" disabled={!question.trim() || !!pending || !hasData}>
                  Ask
                </button>
              </div>
              {suggestions.length > 0 && (
                <div className="chips" aria-label="Suggested questions">
                  {suggestions.map((s) => (
                    <button key={s} type="button" className="chip" data-cursor="ask" onClick={() => submit(s)} disabled={!!pending}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {notice && (
                <p className="notice" role="status">
                  {notice}
                </p>
              )}
              {mode?.mode === "demo" && (
                <p className="demo-note">
                  Demo mode handles simple questions (totals, averages, counts, top 5, trends). Add an AI key to ask anything, including joins and follow-ups.
                </p>
              )}
            </form>

            <section className="feed" aria-label="Answers">
              {pending && <PendingCard question={pending.question} stage={STAGES[pending.stage]} />}
              {answers.map((a, i) => (
                <AnswerCard
                  key={a.id}
                  answer={a}
                  number={answers.length - i}
                  onRerun={async (sql) => {
                    const next = await rerun(a, sql);
                    setAnswers((as) => as.map((x) => (x.id === a.id ? next : x)));
                  }}
                  onFollowUp={() => {
                    input.current?.focus();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              ))}
              {!pending && answers.length === 0 && hasData && (
                <div className="feed-empty">
                  <p>Your answers print here.</p>
                  <p className="feed-empty-sub">Pick a suggestion above, or click a column name to drop it into your question.</p>
                </div>
              )}
            </section>
          </main>
        </div>
      )}

      {dragging && (
        <div className="dropzone" aria-hidden="true">
          <div className="dropzone-card">
            <Buddy size={110} />
            <p>Let go — I’ll read it.</p>
          </div>
        </div>
      )}

      <footer className="colophon">
        <span>SQL Buddy · DuckDB-WASM in your browser · only column names and a few sample values are sent to the AI</span>
      </footer>
    </div>
  );
}
