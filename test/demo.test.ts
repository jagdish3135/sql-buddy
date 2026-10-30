import { describe, expect, it } from "vitest";
import { translate } from "../src/lib/demo";
import { orders, outlets } from "./fixtures";

const t = (q: string) => translate(q, [orders, outlets]);

describe("demo translator", () => {
  it("trends revenue by month", () => {
    const a = t("Revenue by month");
    expect(a.sql).toBe("SELECT date_trunc('month', order_date) AS month, sum(amount) AS total_amount FROM tapri_orders GROUP BY 1 ORDER BY month");
    expect(a.chart).toEqual({ type: "line", x: "month", y: "total_amount" });
  });

  it("filters on a known value and groups by the named column", () => {
    const a = t("Which outlet sold the most chai?");
    expect(a.sql).toContain("WHERE category = 'Chai'");
    expect(a.sql).toContain("SELECT outlet, sum(qty) AS total_qty");
    expect(a.chart.type).toBe("bar");
  });

  it("handles top N", () => {
    expect(t("Top 5 items by revenue").sql).toBe("SELECT item, sum(amount) AS total_amount FROM tapri_orders GROUP BY 1 ORDER BY total_amount DESC LIMIT 5");
  });

  it("averages per group", () => {
    expect(t("Average amount by payment").sql).toContain("round(avg(amount), 2) AS avg_amount");
  });

  it("counts by hour as a line", () => {
    const a = t("Busiest hour of the day");
    expect(a.sql).toContain("SELECT hour, count(*)");
    expect(a.chart.type).toBe("line");
  });

  it("returns a single number with a filter", () => {
    const a = t("How many orders were paid by UPI?");
    expect(a.sql).toBe("SELECT count(*) AS orders FROM tapri_orders WHERE payment = 'UPI'");
    expect(a.chart.type).toBe("number");
  });

  it("picks the table the question is about", () => {
    expect(t("Total seats by city").sql).toBe("SELECT city, sum(seats) AS total_seats FROM tapri_outlets GROUP BY 1 ORDER BY total_seats DESC LIMIT 50");
  });

  it("falls back to showing rows", () => {
    const a = t("tell me a story");
    expect(a.sql).toBe("SELECT * FROM tapri_orders LIMIT 200");
    expect(a.chart.type).toBe("table");
  });
});
