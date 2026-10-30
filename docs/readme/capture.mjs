// Captures raw README screenshots (docs/readme/raw, turned into cards by cards.mjs)
// and the raw demo recording (docs/readme/raw/demo.mp4).
// Usage: node docs/readme/capture.mjs [shots,video] [baseUrl]
// Needs the app running (npm run dev, port 5200) and ffmpeg on PATH.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const what = (process.argv[2] ?? "shots,video").split(",");
const BASE = process.argv[3] ?? "http://localhost:5200/";
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
const browser = await chromium.launch();

async function ready(page, { hideCursor = false } = {}) {
  await page.getByText("DuckDB ready").waitFor({ timeout: 120000 });
  // Still screenshots look cleaner without the pen cursor; the video keeps it.
  if (hideCursor) await page.addStyleTag({ content: ".cursor { display: none !important; }" });
  await page.evaluate(() => document.fonts.ready);
}

async function loadSamples(page) {
  await page.getByRole("button", { name: "Try the chai shop data" }).first().click();
  await page.locator(".chip").first().waitFor({ timeout: 60000 });
}

async function ask(page, question) {
  await page.getByRole("button", { name: question }).click();
  await page.locator(".answer:not(.pending) .answer-q", { hasText: question }).waitFor();
  await page.waitForTimeout(1300);
}

// A fake AI reply, so the screenshot shows an AI answer without needing a key.
async function mockAi(page) {
  await page.route("**/api/ask", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { mode: "claude", model: "claude-opus-5-5" } });
    return route.fulfill({
      json: {
        mode: "claude",
        model: "claude-opus-5-5",
        sql: "SELECT o.city, round(sum(t.amount) / any_value(s.seats), 0) AS revenue_per_seat\nFROM tapri_orders t\nJOIN tapri_outlets o USING (outlet)\nJOIN (SELECT city, sum(seats) AS seats FROM tapri_outlets GROUP BY 1) s USING (city)\nGROUP BY 1\nORDER BY revenue_per_seat DESC",
        title: "Revenue per seat by city",
        explanation: "Joins every order to its outlet, adds up revenue per city and divides by that city's total seats.",
        chart: { type: "bar", x: "city", y: "revenue_per_seat" },
      },
    });
  });
}

if (what.includes("shots")) {
  mkdirSync(join(here, "raw"), { recursive: true });
  const jpg = (name) => ({ path: join(here, "raw", `${name}.jpg`), type: "jpeg", quality: 90 });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  await page.goto(BASE);
  await ready(page, { hideCursor: true });
  await page.mouse.move(1060, 640);
  await page.waitForTimeout(1200);
  await page.screenshot(jpg("landing"));
  await page.locator(".demo").scrollIntoViewIfNeeded();
  await page.waitForTimeout(6500);
  await page.locator(".demo").screenshot(jpg("live-demo"));
  for (const sel of [".clips", ".split"]) {
    await page.locator(sel).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
  }
  await page.evaluate(() => {
    const head = document.querySelector(".privacy .band-head").getBoundingClientRect().top;
    window.scrollTo(0, head + window.scrollY - 70);
  });
  await page.waitForTimeout(600);
  await page.screenshot(jpg("privacy"));
  await page.evaluate(() => window.scrollTo(0, 0));
  await loadSamples(page);
  await ask(page, "Revenue by month");
  await ask(page, "Which outlet sold the most chai?");
  await page.mouse.move(700, 300);
  await page.screenshot(jpg("answers"));
  await page.close();

  const ai = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  await mockAi(ai);
  await ai.goto(BASE);
  await ready(ai, { hideCursor: true });
  await loadSamples(ai);
  await ask(ai, "Revenue per seat for each city");
  await ai.mouse.move(1300, 120);
  await ai.screenshot(jpg("ai-join"));
  await ai.close();

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.goto(BASE);
  await ready(phone, { hideCursor: true });
  await phone.waitForTimeout(1000);
  await phone.screenshot(jpg("mobile-landing"));
  await loadSamples(phone);
  await ask(phone, "Top 5 items by revenue");
  await phone.evaluate(() => window.scrollTo(0, document.querySelector(".answer").getBoundingClientRect().top + window.scrollY - 16));
  await phone.waitForTimeout(800);
  await phone.screenshot(jpg("mobile-answer"));
  await phone.close();
  console.log("shots done");
}

if (what.includes("video")) {
  const size = { width: 1280, height: 720 };
  const tmp = mkdtempSync(join(tmpdir(), "sqlbuddy-video-"));
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: tmp, size }, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(BASE);
  await ready(page);
  await page.mouse.move(640, 300);
  await page.waitForTimeout(400);
  const startAt = (Date.now() - t0) / 1000;

  const glide = async (x, y, steps = 30) => page.mouse.move(x, y, { steps });
  const glideTo = async (locator, dx = 0.5, dy = 0.5) => {
    const b = await locator.boundingBox();
    await glide(b.x + b.width * dx, b.y + b.height * dy);
  };

  // 1. Hero, pen over the drop poster
  await page.waitForTimeout(900);
  await glideTo(page.locator(".drop-poster"), 0.5, 0.7);
  await page.waitForTimeout(1200);
  // 2. The live demo
  await page.evaluate(() => document.getElementById("watch").scrollIntoView({ behavior: "smooth" }));
  await page.waitForTimeout(6800);
  // 3. Load the samples and ask
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await page.waitForTimeout(900);
  await glideTo(page.getByRole("button", { name: "Try the chai shop data" }).first());
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Try the chai shop data" }).first().click();
  await page.locator(".chip").first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(700);
  for (const q of ["Revenue by month", "Which outlet sold the most chai?"]) {
    await glideTo(page.getByRole("button", { name: q }));
    await page.waitForTimeout(250);
    await page.getByRole("button", { name: q }).click();
    await page.locator(".answer:not(.pending) .answer-q", { hasText: q }).waitFor();
    await page.waitForTimeout(1600);
  }
  // 4. Hover the bars
  const chart = await page.locator(".answer .chart svg").first().boundingBox();
  for (const f of [0.15, 0.45, 0.8]) {
    await glide(chart.x + chart.width * 0.5, chart.y + chart.height * f, 14);
    await page.waitForTimeout(450);
  }
  // 5. Edit the SQL: chai -> coffee, run it
  await glideTo(page.locator("pre.sql").first(), 0.3, 0.4);
  await page.waitForTimeout(300);
  await page.locator("pre.sql").first().click();
  const box = page.locator(".sql-edit").first();
  const sql = await box.inputValue();
  await box.fill(sql.replace("'Chai'", "'Coffee'"));
  await page.waitForTimeout(500);
  await glideTo(page.getByRole("button", { name: /Run it/ }).first());
  await page.getByRole("button", { name: /Run it/ }).first().click();
  await page.waitForTimeout(2600);

  await ctx.close();
  const webm = join(tmp, readdirSync(tmp).find((f) => f.endsWith(".webm")));
  // The raw recording; cards.mjs frames it in a card and writes demo.mp4/.webp/.gif.
  mkdirSync(join(here, "raw"), { recursive: true });
  ffmpeg("-ss", startAt.toFixed(2), "-i", webm, "-vf", "fps=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", join(here, "raw", "demo.mp4"));
  rmSync(tmp, { recursive: true, force: true });
  console.log("video done, trimmed first", startAt.toFixed(1), "s");
}

await browser.close();
