// Shared by the server and the browser.

/**
 * True when the SQL is one query that only reads the loaded tables: it starts with
 * SELECT/WITH/FROM, has no second statement, and doesn't read files or URLs.
 * The browser checks AI-written SQL with this again before running it.
 */
export function isReadOnly(sql: string): boolean {
  // Blank out quoted identifiers and plain strings so their contents can't trip the checks,
  // but keep string literals that look like file paths or URLs.
  const body = sql
    .trim()
    .replace(/;\s*$/, "")
    .replace(/"(?:[^"]|"")*"/g, '""')
    .replace(/'(?:[^']|'')*'/g, (m) => (/^'(https?:|s3:|gs:|\w+:\/\/|.*\.(csv|tsv|parquet|json|txt)'$)/i.test(m) ? "'FILE'" : "''"));
  if (body.includes(";")) return false;
  // One statement that starts with SELECT/WITH/FROM can't write in DuckDB, so what's
  // left to block is reading other files or URLs.
  if (!/^\(?\s*(with|select|from)\b/i.test(body)) return false;
  if (/\binsert\s+into\b|\bdelete\s+from\b|\bupdate\s+\S+\s+set\b/i.test(body)) return false;
  return !/\b(read_\w+|glob|sniff_csv|parquet_\w+)\s*\(|'FILE'/i.test(body);
}
