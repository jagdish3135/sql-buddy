// The query "receipt": highlighted SQL that can be edited and re-run.
import { useEffect, useRef, useState, type ReactNode } from "react";

const KEYWORDS =
  /^(select|from|where|group|by|order|limit|having|join|left|right|inner|outer|full|cross|on|as|and|or|not|in|is|null|with|case|when|then|else|end|distinct|asc|desc|union|all|between|like|ilike|over|partition|qualify|using|interval|filter|exists)$/i;

const TOKEN = /(?<s>'(?:[^']|'')*')|(?<i>"(?:[^"]|"")*")|(?<c>--[^\n]*)|(?<n>\b\d+(?:\.\d+)?\b)|(?<f>\b[a-z_][a-z0-9_]*(?=\s*\())|(?<w>\b[a-z_][a-z0-9_]*\b)/gi;

function highlight(sql: string) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of sql.matchAll(TOKEN)) {
    const g = m.groups!;
    if (m.index > last) out.push(sql.slice(last, m.index));
    const cls = g.s ? "s" : g.i ? "i" : g.c ? "c" : g.n ? "n" : g.f ? (KEYWORDS.test(g.f) ? "k" : "f") : KEYWORDS.test(g.w) ? "k" : "";
    out.push(
      cls ? (
        <span key={m.index} className={`t-${cls}`}>
          {m[0]}
        </span>
      ) : (
        m[0]
      ),
    );
    last = m.index + m[0].length;
  }
  out.push(sql.slice(last));
  return out;
}

/** Breaks a one-line query onto lines before major clauses. */
export function pretty(sql: string): string {
  if (sql.includes("\n")) return sql;
  return sql
    .replace(/\s+(FROM|WHERE|GROUP BY|ORDER BY|LIMIT|HAVING|LEFT JOIN|INNER JOIN|JOIN|UNION ALL|QUALIFY)\b/gi, "\n$1")
    .replace(/^(SELECT)\s+/i, "$1 ");
}

interface Props {
  sql: string;
  onRun: (sql: string) => void;
  busy?: boolean;
  /** Show only, with no edit button (used by the landing page demo). */
  readOnly?: boolean;
}

export function SqlView({ sql, onRun, busy, readOnly }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(pretty(sql));
  const [copied, setCopied] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setDraft(pretty(sql)), [sql]);
  useEffect(() => {
    if (editing) area.current?.focus();
  }, [editing]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="receipt">
      <div className="receipt-head">
        <span>THE QUERY</span>
        <span className="receipt-actions">
          <button type="button" onClick={copy}>
            {copied ? "copied" : "copy"}
          </button>
          {!readOnly && (
            <button type="button" onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
              {editing ? "cancel" : "edit"}
            </button>
          )}
        </span>
      </div>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onRun(draft);
            setEditing(false);
          }}
        >
          <textarea
            ref={area}
            className="sql-edit"
            value={draft}
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onRun(draft);
                setEditing(false);
              }
            }}
            aria-label="Edit SQL"
          />
          <button className="run" type="submit" disabled={busy}>
            Run it ⌘↵
          </button>
        </form>
      ) : (
        <pre className="sql" data-cursor={readOnly ? undefined : "edit"} onClick={readOnly ? undefined : () => setEditing(true)} title={readOnly ? undefined : "Click to edit"}>
          <code>{highlight(draft)}</code>
        </pre>
      )}
    </div>
  );
}
