import { useMemo, useState } from "react";
import type { Answer } from "../lib/buddy";
import { pickChart } from "../lib/chart";
import { toCsv } from "../lib/format";
import { Buddy } from "./Buddy";
import { Chart } from "./Chart";
import { SqlView } from "./SqlView";
import { TableView } from "./TableView";

const MODE_LABEL = { claude: "Claude", openai: "AI", demo: "Demo mode" } as const;

interface Props {
  answer: Answer;
  number: number;
  onRerun: (sql: string) => void;
  onFollowUp: () => void;
}

export function AnswerCard({ answer, number, onRerun, onFollowUp }: Props) {
  const spec = useMemo(
    () => (answer.result ? pickChart(answer.result.columns, answer.result.rows.length, answer.chart) : { type: "table" as const }),
    [answer.result, answer.chart],
  );
  const [view, setView] = useState<"chart" | "table" | null>(null);
  const shown = view ?? (spec.type === "table" ? "table" : "chart");

  const download = () => {
    if (!answer.result) return;
    const csv = toCsv(answer.result.columns.map((c) => c.name), answer.result.rows);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${(answer.title || "answer").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <article className="answer">
      <header className="answer-head">
        <span className="issue">No. {String(number).padStart(2, "0")}</span>
        <span className={`stamp stamp-${answer.mode}`}>
          {MODE_LABEL[answer.mode]}
          {answer.edited ? " · edited" : ""}
        </span>
      </header>
      <h3 className="answer-q">“{answer.question}”</h3>
      {answer.title && <p className="answer-title">{answer.title}</p>}
      {answer.explanation && <p className="answer-why">{answer.explanation}</p>}

      <div className={`answer-body${answer.sql ? "" : " no-sql"}`}>
        <div className="answer-viz">
          {answer.error ? (
            <div className="oops">
              <Buddy size={54} mood="oops" />
              <div>
                <p className="oops-title">That didn’t run.</p>
                <p className="oops-msg">{answer.error}</p>
                {answer.sql && <p className="oops-hint">Edit the query and run it again, or rephrase the question.</p>}
              </div>
            </div>
          ) : answer.result ? (
            <>
              {spec.type !== "table" && (
                <div className="tabs" role="tablist">
                  <button role="tab" aria-selected={shown === "chart"} onClick={() => setView("chart")}>
                    Chart
                  </button>
                  <button role="tab" aria-selected={shown === "table"} onClick={() => setView("table")}>
                    Table
                  </button>
                </div>
              )}
              {answer.result.rows.length === 0 ? (
                <p className="empty-result">No rows matched. Try loosening the question.</p>
              ) : shown === "chart" ? (
                <Chart spec={spec} result={answer.result} />
              ) : (
                <TableView result={answer.result} />
              )}
            </>
          ) : null}
        </div>
        {answer.sql && <SqlView sql={answer.sql} onRun={onRerun} />}
      </div>

      <footer className="answer-foot">
        {answer.result && (
          <span className="meta">
            {answer.result.rows.length.toLocaleString()}
            {answer.result.truncated ? "+" : ""} row{answer.result.rows.length === 1 ? "" : "s"} · {answer.result.ms < 1 ? "<1" : Math.round(answer.result.ms)} ms in your browser
          </span>
        )}
        <span className="foot-actions">
          {answer.result && answer.result.rows.length > 0 && (
            <button type="button" onClick={download}>
              ↓ CSV
            </button>
          )}
          <button type="button" onClick={onFollowUp}>
            Ask a follow-up →
          </button>
        </span>
      </footer>
    </article>
  );
}

export function PendingCard({ question, stage }: { question: string; stage: string }) {
  return (
    <article className="answer pending" aria-live="polite">
      <header className="answer-head">
        <span className="issue">Printing…</span>
      </header>
      <h3 className="answer-q">“{question}”</h3>
      <div className="pending-body">
        <Buddy size={72} thinking />
        <p className="pending-stage">{stage}</p>
      </div>
    </article>
  );
}
