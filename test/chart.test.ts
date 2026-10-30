import { describe, expect, it } from "vitest";
import { pickChart } from "../src/lib/chart";

const col = (name: string, kind: "number" | "text" | "date") => ({ name, kind });

describe("pickChart", () => {
  it("shows one value as a big number", () => {
    expect(pickChart([col("total", "number")], 1)).toEqual({ type: "number", y: "total" });
  });
  it("draws dates as a line", () => {
    expect(pickChart([col("month", "date"), col("revenue", "number")], 12)).toEqual({ type: "line", x: "month", y: "revenue" });
  });
  it("draws categories as bars", () => {
    expect(pickChart([col("outlet", "text"), col("orders", "number")], 6)).toEqual({ type: "bar", x: "outlet", y: "orders" });
  });
  it("follows a valid hint", () => {
    expect(pickChart([col("a", "number"), col("b", "number")], 30, { type: "scatter", x: "a", y: "b" }).type).toBe("scatter");
  });
  it("ignores a hint that names missing columns", () => {
    expect(pickChart([col("outlet", "text"), col("orders", "number")], 6, { type: "line", x: "nope", y: "orders" }).type).toBe("bar");
  });
  it("uses a table for text-only results", () => {
    expect(pickChart([col("name", "text"), col("city", "text")], 10).type).toBe("table");
  });
});
