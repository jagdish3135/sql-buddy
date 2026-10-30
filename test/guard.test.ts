import { describe, expect, it } from "vitest";
import { isReadOnly } from "../src/lib/guard";

describe("isReadOnly", () => {
  it.each([
    "SELECT * FROM t",
    "select a, count(*) from t group by 1;",
    "WITH x AS (SELECT 1 AS a) SELECT * FROM x",
    "FROM t LIMIT 5",
    'SELECT "load", "export" FROM t',
    "SELECT 'drop table t' AS joke",
    "SELECT * FROM t WHERE note = 'a;b'",
  ])("allows %s", (sql) => expect(isReadOnly(sql)).toBe(true));

  it.each([
    "DROP TABLE t",
    "SELECT 1; DROP TABLE t",
    "INSERT INTO t VALUES (1)",
    "COPY t TO 'out.csv'",
    "ATTACH 'x.db'",
    "INSTALL httpfs",
    "SELECT * FROM read_csv('https://evil.example/x.csv')",
    "SELECT * FROM 'https://evil.example/x.parquet'",
    "SELECT * FROM 'secret.csv'",
    "SELECT * FROM glob('*')",
    "WITH x AS (SELECT 1) INSERT INTO t SELECT * FROM x",
  ])("blocks %s", (sql) => expect(isReadOnly(sql)).toBe(false));
});
