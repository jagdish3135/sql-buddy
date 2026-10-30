// Turns the raw screenshots in docs/readme/raw into designed README cards:
// cream paper, a rounded ink border, a title, and the screenshot inside a
// browser window or phone frames with riso offset shadows.
// Usage: node docs/readme/capture.mjs shots && node docs/readme/cards.mjs   (needs ffmpeg)
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const img = (name) => `data:image/jpeg;base64,${readFileSync(join(here, "raw", `${name}.jpg`)).toString("base64")}`;
const W = 1400;
const H = 1160;

const CARDS = [
  {
    file: "card-answers",
    kicker: "Demo mode · no key needed",
    title: "Ask in English. Read the SQL.",
    text: "Totals, averages, counts, top 5 and trends work out of the box.",
    shot: "answers",
    shadow: "var(--blue)",
  },
  {
    file: "card-ai",
    kicker: "With an AI key",
    title: "Joins, follow-ups, anything.",
    text: "Claude or Mistral writes the SQL. This one joins both sample tables.",
    shot: "ai-join",
    shadow: "var(--pink)",
  },
  {
    file: "card-privacy",
    kicker: "Private by design",
    title: "Your rows stay in your tab.",
    text: "DuckDB runs in the browser. Only column names and a few examples go to the AI.",
    shot: "privacy",
    shadow: "var(--pink)",
  },
  {
    file: "card-mobile",
    kicker: "On your phone",
    title: "Works on phones too.",
    text: "Same app, same charts, laid out for a small screen.",
    phones: ["mobile-landing", "mobile-answer"],
  },
];

const css = `
  :root { --paper:#f3ede0; --paper-hi:#fbf8f1; --ink:#1d1d1b; --muted:#5f5a51; --blue:#0078bf; --pink:#ff48b0; --pink-deep:#d1137f; --yellow:#ffe800; }
  * { box-sizing: border-box; margin: 0; }
  html, body { background: transparent; }
  .card {
    position: relative; width: ${W}px; height: ${H}px; padding: 58px 64px 70px;
    display: flex; flex-direction: column; overflow: hidden;
    border: 4px solid var(--ink); border-radius: 36px;
    background: radial-gradient(rgba(29,29,27,.09) 1.3px, transparent 1.6px) 0 0 / 22px 22px, var(--paper);
    font-family: "Schibsted Grotesk", sans-serif; color: var(--ink);
  }
  .tape { position: absolute; top: -6px; left: 50%; width: 150px; height: 40px; transform: translateX(-50%) rotate(-3deg); background: rgba(255,232,0,.85); }
  .kicker { font-family: "Fragment Mono", monospace; font-size: 22px; letter-spacing: .1em; text-transform: uppercase; color: var(--pink-deep); }
  h1 { font-family: "Dela Gothic One", sans-serif; font-weight: 400; font-size: 62px; line-height: 1.05; margin-top: 14px; position: relative; }
  p.text { font-size: 27px; color: var(--muted); margin-top: 12px; }
  .stage { flex: 1; min-height: 0; margin-top: 40px; display: flex; justify-content: center; align-items: stretch; gap: 70px; }
  .window { flex: 1; display: flex; flex-direction: column; border: 4px solid var(--ink); border-radius: 18px; background: var(--paper-hi); overflow: hidden; }
  .bar { flex: none; height: 52px; display: flex; align-items: center; gap: 12px; padding: 0 18px; border-bottom: 4px solid var(--ink); background: var(--paper-hi); }
  .dot { width: 16px; height: 16px; border-radius: 50%; border: 2.5px solid var(--ink); }
  .url { margin-left: 18px; flex: 1; max-width: 560px; font-family: "Fragment Mono", monospace; font-size: 18px; color: var(--muted); background: var(--paper); border: 2.5px solid var(--ink); border-radius: 999px; padding: 4px 18px; }
  .shot { flex: 1; min-height: 0; overflow: hidden; }
  .shot img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top center; }
  .phone { position: relative; height: 100%; aspect-ratio: 390 / 870; border: 13px solid var(--ink); border-radius: 56px; background: var(--ink); }
  .screen { height: 100%; border-radius: 43px; overflow: hidden; background: var(--paper); padding-top: 44px; }
  .screen img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
  .phone::before { content: ""; position: absolute; top: 10px; left: 50%; width: 104px; height: 28px; transform: translateX(-50%); border-radius: 20px; background: var(--ink); z-index: 1; }
  .buddy { position: absolute; right: 54px; top: 46px; }
`;

const buddy = `<svg class="buddy" width="92" height="102" viewBox="0 -10 72 80">
  <g transform="translate(3,-2)" fill="#ff48b0"><path d="M8 16v38c0 6 11 10 24 10s24-4 24-10V16"/><ellipse cx="32" cy="16" rx="24" ry="9"/></g>
  <path d="M8 16v38c0 6 11 10 24 10s24-4 24-10V16c0 5-11 9-24 9S8 21 8 16z" fill="#0078bf"/>
  <path d="M8 30c0 5 11 9 24 9s24-4 24-9M8 44c0 5 11 9 24 9s24-4 24-9" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.6"/>
  <ellipse cx="32" cy="16" rx="24" ry="9" fill="#5bb3e6"/>
  <ellipse cx="24" cy="36" rx="3.2" ry="4" fill="#1d1d1b"/><ellipse cx="40" cy="36" rx="3.2" ry="4" fill="#1d1d1b"/>
  <path d="M27 46q5 4.5 10 0" fill="none" stroke="#1d1d1b" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="18" cy="44" r="2.6" fill="#ff48b0"/><circle cx="46" cy="44" r="2.6" fill="#ff48b0"/></svg>`;

function card(c) {
  const stage = c.phones
    ? c.phones
        .map((p, i) => `<div class="phone" style="rotate:${i ? 2.5 : -2.5}deg; box-shadow: 16px 16px 0 ${i ? "var(--pink)" : "var(--blue)"}"><div class="screen"><img src="${img(p)}"></div></div>`)
        .join("")
    : `<div class="window" style="box-shadow: 18px 18px 0 ${c.shadow}">
        <div class="bar">
          <span class="dot" style="background:var(--pink)"></span><span class="dot" style="background:var(--yellow)"></span><span class="dot" style="background:var(--blue)"></span>
          <span class="url">sql-buddy-app.vercel.app</span>
        </div>
        <div class="shot"><img src="${img(c.shot)}"></div>
      </div>`;
  return `<div class="card"><div class="tape"></div>${buddy}
    <div class="kicker">${c.kicker}</div><h1>${c.title}</h1><p class="text">${c.text}</p>
    <div class="stage">${stage}</div></div>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 });
for (const c of CARDS) {
  await page.setContent(
    `<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Fragment+Mono&family=Schibsted+Grotesk:wght@400;700&display=block" rel="stylesheet"><style>${css}</style></head><body>${card(c)}</body></html>`,
    { waitUntil: "networkidle" },
  );
  await page.evaluate(() => document.fonts.ready);
  const png = join(here, `${c.file}.png`);
  await page.locator(".card").screenshot({ path: png, omitBackground: true });
  // WebP with transparency keeps the rounded corners and is far smaller than PNG.
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", png, "-c:v", "libwebp", "-pix_fmt", "yuva420p", "-quality", "88", join(here, `${c.file}.webp`)]);
  rmSync(png);
  console.log("wrote", `${c.file}.webp`);
}
await browser.close();
