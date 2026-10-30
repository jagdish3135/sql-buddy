import type { TableProfile } from "../lib/types";

const KIND_LABEL = { number: "123", text: "abc", date: "date", bool: "y/n", other: "···" } as const;

interface Props {
  tables: TableProfile[];
  loading: string[];
  onRemove: (name: string) => void;
  onPickColumn: (text: string) => void;
  onAddFiles: () => void;
}

export function TablesRail({ tables, loading, onRemove, onPickColumn, onAddFiles }: Props) {
  return (
    <aside className="rail" aria-label="Your tables">
      <div className="rail-head">
        <h2>Your tables</h2>
        <button type="button" className="rail-add" onClick={onAddFiles}>
          + add file
        </button>
      </div>
      {tables.length === 0 && loading.length === 0 && <p className="rail-empty">Nothing loaded yet. Drop a CSV anywhere on the page.</p>}
      <ol className="tables">
        {tables.map((t, i) => (
          <li key={t.name} className="tcard" style={{ ["--tilt" as string]: `${i % 2 ? 0.6 : -0.5}deg` }}>
            <div className="tcard-top">
              <button type="button" className="tcard-name" title="Insert table name" onClick={() => onPickColumn(t.name)}>
                {t.name}
              </button>
              <button type="button" className="tcard-x" aria-label={`Remove ${t.name}`} onClick={() => onRemove(t.name)}>
                ×
              </button>
            </div>
            <p className="tcard-meta">
              {t.rows.toLocaleString()} rows · {t.columns.length} cols · <span title={t.file}>{t.file}</span>
            </p>
            <ul className="cols">
              {t.columns.map((c) => (
                <li key={c.name}>
                  <button type="button" className={`col col-${c.kind}`} data-cursor="add" title={`${c.type}${c.values?.length ? ` · e.g. ${c.values.slice(0, 3).join(", ")}` : ""}`} onClick={() => onPickColumn(c.name)}>
                    <span className="col-kind">{KIND_LABEL[c.kind]}</span>
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
        {loading.map((f) => (
          <li key={f} className="tcard tcard-loading">
            <span className="tcard-name">{f}</span>
            <p className="tcard-meta">reading…</p>
          </li>
        ))}
      </ol>
    </aside>
  );
}
