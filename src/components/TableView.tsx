import type { QueryResult } from "../lib/db";
import { fmtValue } from "../lib/format";

const SHOW = 200;

export function TableView({ result }: { result: QueryResult }) {
  const rows = result.rows.slice(0, SHOW);
  return (
    <div className="grid-wrap">
      <table className="result-table">
        <thead>
          <tr>
            {result.columns.map((c) => (
              <th key={c.name} className={c.kind === "number" ? "num" : ""}>
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {result.columns.map((c) => (
                <td key={c.name} className={c.kind === "number" ? "num" : ""}>
                  {fmtValue(r[c.name])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length > SHOW && (
        <p className="grid-more">
          Showing {SHOW} of {result.truncated ? `${result.rows.length}+` : result.rows.length} rows. Download the CSV for all of them.
        </p>
      )}
    </div>
  );
}
