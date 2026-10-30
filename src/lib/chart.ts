// Chooses how to draw a query result. The AI's hint wins when it fits the data.
import type { ResultColumn } from "./db";
import type { ChartHint, ChartType } from "./types";

export interface ChartSpec {
  type: ChartType;
  x?: string;
  y?: string;
}

export function pickChart(columns: ResultColumn[], rowCount: number, hint?: ChartHint): ChartSpec {
  const by = (name?: string) => columns.find((c) => c.name === name);
  const nums = columns.filter((c) => c.kind === "number");
  const dates = columns.filter((c) => c.kind === "date");
  const labels = columns.filter((c) => c.kind === "text" || c.kind === "bool");

  if (rowCount === 0) return { type: "table" };
  if (rowCount === 1 && nums.length >= 1 && columns.length <= 4) return { type: "number", y: nums[0].name };

  if (hint && hint.type !== "table") {
    const x = by(hint.x);
    const y = by(hint.y);
    if (hint.type === "number" && rowCount === 1 && nums.length) return { type: "number", y: y?.kind === "number" ? y.name : nums[0].name };
    if (x && y && y.kind === "number" && rowCount > 1) {
      if (hint.type === "scatter" && x.kind === "number") return { type: "scatter", x: x.name, y: y.name };
      if (hint.type === "line" && rowCount >= 2) return { type: "line", x: x.name, y: y.name };
      if (hint.type === "bar" && rowCount <= 60) return { type: "bar", x: x.name, y: y.name };
    }
  }

  if (rowCount < 2 || !nums.length) return { type: "table" };
  if (dates.length) {
    const y = nums.find((c) => c.name !== dates[0].name);
    if (y) return { type: "line", x: dates[0].name, y: y.name };
  }
  if (labels.length && rowCount <= 60) return { type: "bar", x: labels[0].name, y: nums[0].name };
  if (nums.length >= 2) {
    const [x, y] = nums;
    // A small whole-number first column (hour, year, rank) reads better as a line.
    if (/^(hour|year|month|day|week|rank)/i.test(x.name)) return { type: "line", x: x.name, y: y.name };
    return { type: "scatter", x: x.name, y: y.name };
  }
  return { type: "table" };
}
