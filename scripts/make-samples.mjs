// Builds the two sample CSVs in public/samples. The data is fictional:
// "Tapri Co.", a small chai chain with six outlets. Seeded, so output is stable.
import { writeFileSync } from "node:fs";

let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (list) => list[Math.floor(rand() * list.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[0][0];
};

const outlets = [
  ["FC Road", "Pune", "Shivajinagar", "2021-06-14", 28, "Asha Kulkarni"],
  ["Koregaon Park", "Pune", "Koregaon Park", "2022-02-01", 40, "Rohan Deshpande"],
  ["Hinjewadi", "Pune", "Hinjewadi Phase 1", "2023-09-18", 34, "Meera Joshi"],
  ["Bandra West", "Mumbai", "Bandra", "2022-11-05", 22, "Imran Shaikh"],
  ["Lower Parel", "Mumbai", "Lower Parel", "2024-03-11", 30, "Neha Iyer"],
  ["Indiranagar", "Bengaluru", "Indiranagar", "2024-08-20", 36, "Karthik Rao"],
];
const busy = { "FC Road": 1.4, "Koregaon Park": 1.1, Hinjewadi: 1.2, "Bandra West": 1.0, "Lower Parel": 0.9, Indiranagar: 0.8 };

const menu = [
  ["Cutting Chai", "Chai", 20, 30],
  ["Masala Chai", "Chai", 30, 22],
  ["Ginger Chai", "Chai", 30, 14],
  ["Kulhad Chai", "Chai", 40, 10],
  ["Filter Coffee", "Coffee", 40, 12],
  ["Cold Coffee", "Cold", 90, 7],
  ["Lemon Iced Tea", "Cold", 80, 5],
  ["Vada Pav", "Snacks", 25, 16],
  ["Bun Maska", "Snacks", 35, 13],
  ["Poha", "Snacks", 45, 8],
  ["Samosa", "Snacks", 20, 11],
  ["Maggi", "Snacks", 60, 6],
];

const hours = [[7, 6], [8, 10], [9, 9], [10, 6], [11, 5], [12, 5], [13, 6], [14, 4], [15, 5], [16, 8], [17, 11], [18, 10], [19, 7], [20, 5], [21, 3]];

const start = new Date("2025-11-01T00:00:00Z");
const days = 363; // through 2026-10-29
const rows = [["order_id", "order_date", "hour", "outlet", "item", "category", "qty", "unit_price", "amount", "payment"]];
let id = 100000;
for (let d = 0; d < days; d++) {
  const date = new Date(start.getTime() + d * 86400000);
  const iso = date.toISOString().slice(0, 10);
  const month = date.getUTCMonth();
  const weekend = [0, 6].includes(date.getUTCDay());
  const monsoon = month >= 5 && month <= 8; // chai sells more in the rains
  const summer = month >= 2 && month <= 4;
  for (const [outlet, , , opened] of outlets) {
    if (iso < opened) continue;
    const base = 9 * busy[outlet] * (weekend ? 1.25 : 1) * (1 + d / days * 0.35);
    const n = Math.round(base + rand() * 4);
    for (let i = 0; i < n; i++) {
      const [item, category, price] = weighted(
        menu.map((m) => [m, m[3] * (m[1] === "Chai" && monsoon ? 1.5 : 1) * (m[1] === "Cold" && summer ? 2.6 : 1)]),
      );
      const qty = weighted([[1, 60], [2, 25], [3, 9], [4, 4], [6, 2]]);
      const payment = weighted([["UPI", outlet === "Indiranagar" ? 80 : 68], ["Cash", 22], ["Card", 10]]);
      rows.push([++id, iso, weighted(hours), outlet, item, category, qty, price, qty * price, payment]);
    }
  }
}

const csv = (table) => table.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(",")).join("\n") + "\n";
writeFileSync("public/samples/tapri_orders.csv", csv(rows));
writeFileSync(
  "public/samples/tapri_outlets.csv",
  csv([["outlet", "city", "area", "opened_on", "seats", "manager"], ...outlets]),
);
console.log(`orders: ${rows.length - 1} rows`);
