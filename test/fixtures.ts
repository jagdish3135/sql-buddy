import type { TableProfile } from "../src/lib/types";

export const orders: TableProfile = {
  name: "tapri_orders",
  file: "tapri_orders.csv",
  rows: 30600,
  columns: [
    { name: "order_id", type: "BIGINT", kind: "number", min: "100001", max: "130600" },
    { name: "order_date", type: "DATE", kind: "date", min: "2025-11-01", max: "2026-10-29" },
    { name: "hour", type: "BIGINT", kind: "number", min: "7", max: "21" },
    { name: "outlet", type: "VARCHAR", kind: "text", distinct: 6, values: ["FC Road", "Koregaon Park", "Hinjewadi", "Bandra West", "Lower Parel", "Indiranagar"] },
    {
      name: "item",
      type: "VARCHAR",
      kind: "text",
      distinct: 12,
      values: ["Cutting Chai", "Masala Chai", "Ginger Chai", "Kulhad Chai", "Filter Coffee", "Cold Coffee", "Lemon Iced Tea", "Vada Pav", "Bun Maska", "Poha", "Samosa", "Maggi"],
    },
    { name: "category", type: "VARCHAR", kind: "text", distinct: 4, values: ["Chai", "Coffee", "Cold", "Snacks"] },
    { name: "qty", type: "BIGINT", kind: "number", min: "1", max: "6" },
    { name: "unit_price", type: "BIGINT", kind: "number", min: "20", max: "90" },
    { name: "amount", type: "BIGINT", kind: "number", min: "20", max: "540" },
    { name: "payment", type: "VARCHAR", kind: "text", distinct: 3, values: ["UPI", "Cash", "Card"] },
  ],
};

export const outlets: TableProfile = {
  name: "tapri_outlets",
  file: "tapri_outlets.csv",
  rows: 6,
  columns: [
    { name: "outlet", type: "VARCHAR", kind: "text", distinct: 6, values: ["FC Road", "Koregaon Park", "Hinjewadi", "Bandra West", "Lower Parel", "Indiranagar"] },
    { name: "city", type: "VARCHAR", kind: "text", distinct: 3, values: ["Pune", "Mumbai", "Bengaluru"] },
    { name: "seats", type: "BIGINT", kind: "number", min: "22", max: "40" },
  ],
};
