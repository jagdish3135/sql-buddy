// Builds the README banner and "how it works" diagram.
// Fonts are subset from Google Fonts and embedded, so the SVGs look the same on GitHub.
// Usage: node docs/readme/make-svgs.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function font(family, weight, text) {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url, { headers: { "User-Agent": UA } })).text();
  const src = css.match(/url\((https:[^)]+)\)/)?.[1];
  if (!src) throw new Error(`No font file for ${family}`);
  const b64 = Buffer.from(await (await fetch(src)).arrayBuffer()).toString("base64");
  return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}

const ASCII = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,·'\"“”-–()?:/+×&→↓↺*=_;!#%<>";
const fonts = [
  await font("Dela Gothic One", 400, ASCII),
  await font("Schibsted Grotesk", 400, ASCII),
  await font("Schibsted Grotesk", 700, ASCII),
  await font("Fragment Mono", 400, ASCII),
].join("");

const THEMES = {
  light: { bg: "#f3ede0", card: "#fbf8f1", ink: "#1d1d1b", muted: "#5f5a51", dot: "rgba(29,29,27,0.09)", blue: "#0078bf", lid: "#5bb3e6", pink: "#ff48b0", pinkDeep: "#d1137f", yellow: "#ffe800", rule: "rgba(29,29,27,0.18)" },
  dark: { bg: "#161514", card: "#211f1d", ink: "#f3ede0", muted: "#b9b2a4", dot: "rgba(243,237,224,0.08)", blue: "#3d9fdc", lid: "#8fcaf0", pink: "#ff5cbc", pinkDeep: "#ff5cbc", yellow: "#ffe800", rule: "rgba(243,237,224,0.2)" },
};
const DISPLAY = "font-family=\"'Dela Gothic One'\"";
const BODY = "font-family=\"'Schibsted Grotesk'\"";
const MONO = "font-family=\"'Fragment Mono'\"";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function paper(w, h, t) {
  return `<defs><pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="1" fill="${t.dot}"/></pattern></defs>
  <rect width="${w}" height="${h}" fill="${t.bg}"/><rect width="${w}" height="${h}" fill="url(#dots)"/>`;
}

// The mascot: a database cylinder with a face, pink plate printed slightly off-register.
function buddy(x, y, s, t) {
  return `<g transform="translate(${x},${y}) scale(${s})">
    <g transform="translate(3,-2)" fill="${t.pink}"><path d="M8 16v38c0 6 11 10 24 10s24-4 24-10V16"/><ellipse cx="32" cy="16" rx="24" ry="9"/></g>
    <path d="M8 16v38c0 6 11 10 24 10s24-4 24-10V16c0 5-11 9-24 9S8 21 8 16z" fill="${t.blue}"/>
    <path d="M8 30c0 5 11 9 24 9s24-4 24-9M8 44c0 5 11 9 24 9s24-4 24-9" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.6"/>
    <ellipse cx="32" cy="16" rx="24" ry="9" fill="${t.lid}"/>
    <ellipse cx="24" cy="36" rx="3.2" ry="4" fill="#1d1d1b"/><ellipse cx="40" cy="36" rx="3.2" ry="4" fill="#1d1d1b"/>
    <path d="M27 46q5 4.5 10 0" fill="none" stroke="#1d1d1b" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="18" cy="44" r="2.6" fill="${t.pink}"/><circle cx="46" cy="44" r="2.6" fill="${t.pink}"/>
  </g>`;
}

// The highlighter pen cursor, tip at (x, y).
function pen(x, y, s, t) {
  return `<g transform="translate(${x},${y}) scale(${s}) rotate(-35)">
    <rect x="-3.6" y="-39" width="10" height="27" rx="2" fill="none" stroke="${t.pink}" stroke-width="1.4"/>
    <rect x="-5" y="-38" width="10" height="27" rx="2" fill="#fbf8f1" stroke="#1d1d1b" stroke-width="1.4"/>
    <rect x="-5" y="-38" width="10" height="7" rx="2" fill="${t.yellow}" stroke="#1d1d1b" stroke-width="1.4"/>
    <path d="M-5 -11h10l-2.2 10.2h-5.6z" fill="${t.yellow}" stroke="#1d1d1b" stroke-width="1.4" stroke-linejoin="round"/>
  </g>`;
}

function banner(t) {
  const W = 1280, H = 440;
  const bars = [5529, 4662, 4525, 4060, 3777, 3342];
  const names = ["FC Road", "Hinjewadi", "Koregaon", "Bandra", "Parel", "Indira."];
  const bx = 900, by = 128, bw = 330, bh = 150;
  let chart = "";
  bars.forEach((v, i) => {
    const h = (v / 6000) * bh;
    const x = bx + 14 + i * 52;
    chart += `<rect x="${x + 3}" y="${by + bh - h - 3}" width="34" height="${h}" fill="${t.pink}"/>`;
    chart += `<rect x="${x}" y="${by + bh - h}" width="34" height="${h}" fill="${t.blue}"/>`;
    chart += `<text x="${x + 17}" y="${by + bh + 18}" ${BODY} font-size="10" fill="${t.muted}" text-anchor="middle">${names[i]}</text>`;
  });
  const sql = [
    [["SELECT", "k"], [" outlet, ", ""], ["sum", "f"], ["(qty)", ""]],
    [["FROM", "k"], [" tapri_orders", ""]],
    [["WHERE", "k"], [" category = ", ""], ["'Chai'", "s"]],
    [["GROUP BY", "k"], [" 1 ", ""], ["ORDER BY", "k"], [" 2 ", ""], ["DESC", "k"]],
  ];
  const RX = 690, RY = 300; // the query receipt
  const color = { k: t.blue, f: t.pinkDeep, s: t.ink, "": t.ink };
  const sqlText = sql
    .map((line, i) => `<text x="${RX + 12}" y="${RY + 44 + i * 20}" ${MONO} font-size="12">${line.map(([s, k]) => (k === "s" ? `<tspan fill="${t.ink}" style="font-weight:400">${esc(s)}</tspan>` : `<tspan fill="${color[k]}">${esc(s)}</tspan>`)).join("")}</text>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <style>${fonts}</style>
  ${paper(W, H, t)}
  <rect x="0" y="${H - 8}" width="${W}" height="8" fill="${t.pink}"/>
  <!-- wordmark with misregistered pink plate -->
  <text x="63" y="137" ${DISPLAY} font-size="92" fill="${t.pink}">SQL Buddy</text>
  <text x="60" y="140" ${DISPLAY} font-size="92" fill="${t.blue}">SQL Buddy</text>
  <text x="62" y="192" ${BODY} font-size="27" font-weight="700" fill="${t.ink}">Drop in spreadsheets. Ask in plain English.</text>
  <text x="62" y="228" ${BODY} font-size="20" fill="${t.muted}">It writes the SQL, shows you every line, runs it</text>
  <text x="62" y="254" ${BODY} font-size="20" fill="${t.muted}">in your browser and charts the answer.</text>
  ${[["DuckDB-WASM", t.blue], ["Claude · Mistral · demo", t.pinkDeep], ["rows never leave your tab", t.ink]]
    .map(([label, c], i) => {
      const x = 62 + [0, 160, 382][i];
      const w = [146, 210, 236][i];
      return `<rect x="${x}" y="292" width="${w}" height="34" rx="17" fill="${i === 2 ? t.yellow : t.card}" stroke="${t.ink}" stroke-width="1.5"/>
      <text x="${x + w / 2}" y="314" ${MONO} font-size="13" fill="${i === 2 ? "#1d1d1b" : c}" text-anchor="middle">${label}</text>`;
    })
    .join("")}
  <text x="62" y="384" ${MONO} font-size="13" fill="${t.muted}">“Which outlet sold the most chai?”  →  SQL  →  chart, in about 10 ms</text>
  <!-- the query receipt -->

  <!-- the chart card -->
  <rect x="${bx - 10 + 7}" y="${by - 34 + 7}" width="${bw + 20}" height="${bh + 74}" fill="${t.blue}"/>
  <rect x="${bx - 10}" y="${by - 34}" width="${bw + 20}" height="${bh + 74}" fill="${t.card}" stroke="${t.ink}" stroke-width="2"/>
  <text x="${bx + 4}" y="${by - 12}" ${MONO} font-size="11" fill="${t.muted}" letter-spacing="1">CUPS OF CHAI SOLD</text>
  <line x1="${bx + 6}" y1="${by + bh}" x2="${bx + bw + 4}" y2="${by + bh}" stroke="${t.ink}" stroke-width="1.5"/>
  ${chart}
  <rect x="${bx + 8}" y="${by + bh + 26}" width="54" height="7" fill="${t.yellow}" transform="rotate(-1 ${bx + 8} ${by + bh + 26})"/>
  <rect x="${RX + 6}" y="${RY + 6}" width="262" height="112" fill="${t.pink}"/>
  <rect x="${RX}" y="${RY}" width="262" height="112" fill="${t.card}" stroke="${t.ink}" stroke-width="1.5"/>
  <rect x="${RX}" y="${RY}" width="262" height="22" fill="${t.ink}"/>
  <text x="${RX + 12}" y="${RY + 15}" ${MONO} font-size="10.5" fill="${t.bg}" letter-spacing="1.2">THE QUERY</text>
  ${sqlText}
  ${buddy(1124, 18, 1.45, t)}
  ${pen(RX + 236, RY + 84, 1.5, t)}
</svg>`;
}

function howItWorks(t) {
  const W = 1280, H = 330;
  const steps = [
    ["01", "Drop files", "CSV · TSV · JSON · Parquet", "Each file becomes a table"],
    ["02", "DuckDB in your tab", "WebAssembly + a Web Worker", "Profiles every column"],
    ["03", "AI writes SQL", "Claude or Mistral via /api/ask", "Gets column names only"],
    ["04", "Run + chart", "read-only check, then DuckDB", "Line · bars · number · table"],
  ];
  const bw = 250, gap = 54, x0 = 46, y = 92, bh = 150;
  let s = "";
  steps.forEach(([n, title, sub, note], i) => {
    const x = x0 + i * (bw + gap);
    const shadow = i % 2 ? t.pink : t.blue;
    s += `<rect x="${x + 6}" y="${y + 6}" width="${bw}" height="${bh}" fill="${shadow}"/>
      <rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${t.card}" stroke="${t.ink}" stroke-width="2"/>
      <text x="${x + 20}" y="${y + 50}" ${DISPLAY} font-size="40" fill="${t.pink}">${n}</text>
      <text x="${x + 20}" y="${y + 86}" ${DISPLAY} font-size="20" fill="${t.ink}">${title}</text>
      <text x="${x + 20}" y="${y + 112}" ${MONO} font-size="12" fill="${t.blue}">${sub}</text>
      <text x="${x + 20}" y="${y + 134}" ${BODY} font-size="14" fill="${t.muted}">${note}</text>`;
    if (i < steps.length - 1) s += `<text x="${x + bw + gap / 2 + 3}" y="${y + bh / 2 + 14}" ${DISPLAY} font-size="34" fill="${t.pink}" text-anchor="middle">→</text>`;
  });
  // retry loop from step 4 back to step 3
  const x3 = x0 + 2 * (bw + gap) + bw / 2, x4 = x0 + 3 * (bw + gap) + bw / 2;
  s += `<path d="M${x4} ${y + bh + 14} v22 H${x3} v-18" fill="none" stroke="${t.pinkDeep}" stroke-width="2" stroke-dasharray="6 5"/>
    <path d="M${x3 - 6} ${y + bh + 22} l6 -9 l6 9z" fill="${t.pinkDeep}"/>
    <text x="${(x3 + x4) / 2}" y="${y + bh + 58}" ${MONO} font-size="12.5" fill="${t.pinkDeep}" text-anchor="middle">SQL failed? the error goes back once, and the fix runs</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <style>${fonts}</style>
  ${paper(W, H, t)}
  <text x="${x0}" y="58" ${DISPLAY} font-size="28" fill="${t.ink}">How it works</text>
  <rect x="${x0 + 222}" y="36" width="490" height="30" fill="${t.yellow}"/>
  <text x="${x0 + 236}" y="57" ${MONO} font-size="13.5" fill="#1d1d1b">your rows stay in the browser — only the schema travels</text>
  ${s}
</svg>`;
}

// Cream paper only (the owner doesn't want a dark variant), with rounded corners and an
// ink border so the card sits cleanly on both GitHub themes.
function rounded(svg) {
  const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/);
  return svg
    .replace("</style>", `</style><defs><clipPath id="round"><rect width="${w}" height="${h}" rx="26"/></clipPath></defs><g clip-path="url(#round)">`)
    .replace(/<\/svg>\s*$/, `</g><rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="25" fill="none" stroke="#1d1d1b" stroke-width="3"/></svg>`);
}

writeFileSync(join(here, "banner.svg"), rounded(banner(THEMES.light)));
writeFileSync(join(here, "how-it-works.svg"), rounded(howItWorks(THEMES.light)));
console.log("wrote banner.svg + how-it-works.svg");
