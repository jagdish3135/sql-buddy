// The page people see before loading any data: a hero, then a scroll of sections
// that show what SQL Buddy does, using numbers from the real sample data.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { QueryResult } from "../lib/db";
import { Buddy } from "./Buddy";
import { Chart } from "./Chart";
import { SqlView } from "./SqlView";

interface Props {
  onChoose: () => void;
  onSamples: () => void;
  disabled: boolean;
}

/** Adds the "in" class once the element scrolls into view. */
function Reveal({ children, className = "", as: Tag = "section", delay = 0 }: { children: ReactNode; className?: string; as?: "section" | "div" | "li"; delay?: number }) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) return setInView(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setInView(true), io.disconnect()), { threshold: 0.18 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={(n: HTMLElement | null) => void (ref.current = n)} className={`reveal ${inView ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

const TICKER = [
  "Revenue by month",
  "Which outlet sold the most chai?",
  "Top 5 items by revenue",
  "Busiest hour of the day",
  "Average bill by payment method",
  "Now only for UPI",
  "Revenue per seat in each city",
  "Did cold drinks sell more in summer?",
];

// Real answers from the Tapri Co. sample data.
const DEMO_Q = "Which outlet sold the most chai?";
const DEMO_SQL = "SELECT outlet, sum(qty) AS cups_sold\nFROM tapri_orders\nWHERE category = 'Chai'\nGROUP BY 1\nORDER BY cups_sold DESC";
const DEMO_RESULT: QueryResult = {
  columns: [
    { name: "outlet", kind: "text" },
    { name: "cups_sold", kind: "number" },
  ],
  rows: [
    ["FC Road", 5529],
    ["Hinjewadi", 4662],
    ["Koregaon Park", 4525],
    ["Bandra West", 4060],
    ["Lower Parel", 3777],
    ["Indiranagar", 3342],
  ].map(([outlet, cups_sold]) => ({ outlet, cups_sold })),
  ms: 10,
  truncated: false,
};

/** Types the question, prints the SQL, then draws the chart, and loops while on screen. */
function LiveDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState(0);
  const [lines, setLines] = useState(0);
  const [showChart, setShowChart] = useState(false);
  const [run, setRun] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return setVisible(true);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sqlLines = DEMO_SQL.split("\n").length;
    if (reduce) {
      setTyped(DEMO_Q.length);
      setLines(sqlLines);
      setShowChart(true);
      return;
    }
    setTyped(0);
    setLines(0);
    setShowChart(false);
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    let t = 400;
    for (let i = 1; i <= DEMO_Q.length; i++) at((t += 45), () => setTyped(i));
    t += 500;
    for (let i = 1; i <= sqlLines; i++) at((t += 260), () => setLines(i));
    at((t += 400), () => setShowChart(true));
    at(t + 7000, () => setRun((r) => r + 1));
    return () => timers.forEach(clearTimeout);
  }, [visible, run]);

  const sql = DEMO_SQL.split("\n").slice(0, lines).join("\n");
  return (
    <div className="demo" ref={ref}>
      <div className="demo-ask">
        <span className="demo-label">YOU ASK</span>
        <p className="demo-q">
          {DEMO_Q.slice(0, typed)}
          <span className="caret" aria-hidden="true" />
        </p>
      </div>
      <div className="demo-grid">
        <div className="demo-sql">{lines > 0 ? <SqlView sql={sql} onRun={() => {}} readOnly /> : <div className="demo-wait"><Buddy size={56} thinking /></div>}</div>
        <div className="demo-chart" data-cursor="live">
          <span className="demo-label">BUDDY DRAWS</span>
          {showChart ? <Chart key={run} spec={{ type: "bar", x: "outlet", y: "cups_sold" }} result={DEMO_RESULT} /> : <div className="demo-blank" />}
          {showChart && <p className="demo-meta">6 rows · 10 ms · 30,600 orders scanned in the browser</p>}
        </div>
      </div>
    </div>
  );
}

const EXAMPLES: { q: string; sql: string; chart: "line" | "bar" | "number" | "scatter" }[] = [
  { q: "Revenue by month", sql: "date_trunc('month', order_date)", chart: "line" },
  { q: "How many orders were paid by UPI?", sql: "count(*) … WHERE payment = 'UPI'", chart: "number" },
  { q: "Top 5 items by revenue", sql: "ORDER BY total DESC LIMIT 5", chart: "bar" },
  { q: "Revenue per seat in each city", sql: "JOIN tapri_outlets USING (outlet)", chart: "bar" },
  { q: "Now only for weekends", sql: "WHERE dayofweek(order_date) IN (0, 6)", chart: "line" },
  { q: "Do bigger outlets sell more?", sql: "seats, sum(amount) … GROUP BY outlet", chart: "scatter" },
];

function MiniChart({ type }: { type: "line" | "bar" | "number" | "scatter" | "table" }) {
  return (
    <svg className="mini" viewBox="0 0 120 70" aria-hidden="true">
      {type === "line" && (
        <>
          <path className="mini-pink" d="M8 52 L30 44 L50 48 L70 26 L92 30 L114 16" transform="translate(3,-3)" />
          <path className="mini-blue" d="M8 52 L30 44 L50 48 L70 26 L92 30 L114 16" />
        </>
      )}
      {type === "bar" &&
        [50, 38, 30, 22, 16].map((h, i) => (
          <g key={i}>
            <rect className="mini-fill-pink" x={10 + i * 22 + 3} y={62 - h - 3} width={14} height={h} />
            <rect className="mini-fill-blue" x={10 + i * 22} y={62 - h} width={14} height={h} />
          </g>
        ))}
      {type === "number" && (
        <>
          <text className="mini-num mini-num-pink" x={63} y={50} textAnchor="middle">
            21k
          </text>
          <text className="mini-num" x={60} y={53} textAnchor="middle">
            21k
          </text>
        </>
      )}
      {type === "scatter" &&
        [
          [16, 50],
          [30, 44],
          [46, 40],
          [58, 30],
          [74, 34],
          [88, 22],
          [104, 14],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle className="mini-fill-pink" cx={x + 2.5} cy={y - 2.5} r={5} />
            <circle className="mini-fill-blue" cx={x} cy={y} r={5} />
          </g>
        ))}
      {type === "table" &&
        [0, 1, 2, 3, 4].map((r) => (
          <g key={r}>
            <rect className={r === 0 ? "mini-fill-ink" : "mini-row"} x={8} y={8 + r * 11} width={104} height={9} />
            {r > 0 && <rect className="mini-fill-blue" x={84} y={10 + r * 11} width={24} height={5} />}
          </g>
        ))}
    </svg>
  );
}

const CHARTS: { type: "line" | "bar" | "number" | "scatter" | "table"; name: string; when: string }[] = [
  { type: "line", name: "Line", when: "Anything over time: days, months, hours." },
  { type: "bar", name: "Bars", when: "Comparing outlets, items, cities, people." },
  { type: "number", name: "Big number", when: "One answer: a total, a count, an average." },
  { type: "scatter", name: "Scatter", when: "Two measures side by side, like seats vs sales." },
  { type: "table", name: "Table", when: "Lists of rows. Download any of them as CSV." },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Do I need to know SQL?", a: "No. Ask the way you'd ask a colleague. The SQL is shown so you can learn from it or check it, not because you have to write it." },
  { q: "Is my spreadsheet uploaded anywhere?", a: "No. Files are read and queried by DuckDB inside your browser tab. The AI only receives column names, their types and a few example values so it knows what to write." },
  { q: "What files can I use?", a: "CSV, TSV, JSON and Parquet. Drop several and SQL Buddy can join them, like orders with outlets." },
  { q: "What if the SQL is wrong?", a: "If a query fails, Buddy sends the error back to the AI once and runs the fix. You can also edit any query yourself and run it again." },
  { q: "Which AI does it use?", a: "Claude when an Anthropic key is set, or any OpenAI-compatible model such as Mistral. With no key it runs a built-in demo translator for simple questions." },
  { q: "Can it change or delete my data?", a: "AI-written queries are checked before they run: one read-only statement, no writes, no other files, no URLs." },
];

export function Landing({ onChoose, onSamples, disabled }: Props) {
  const actions = (
    <div className="hero-actions">
      <button type="button" className="btn btn-ink" onClick={onChoose}>
        Choose CSV files
      </button>
      <button type="button" className="btn btn-paper" onClick={onSamples} disabled={disabled}>
        Try the chai shop data
      </button>
    </div>
  );

  return (
    <main className="landing">
      {/* 1. Hero */}
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">Issue 01 · plain English in, SQL out</p>
          <h2 className="hero-title">
            Drop a spreadsheet.
            <br />
            <span className="hl">Ask it anything.</span>
          </h2>
          <p className="hero-text">
            SQL Buddy writes the query, shows you every line of it, runs it right here in your browser and draws the answer. Your rows never leave this tab.
          </p>
          {actions}
          <p className="hero-fine">CSV · TSV · JSON · Parquet. Or just drag files onto this page.</p>
        </div>
        <button type="button" className="drop-poster" data-cursor="drop" onClick={onChoose} aria-label="Choose files to load">
          <span className="poster-inner">
            <Buddy size={120} />
            <span className="poster-big">
              DROP
              <br />
              CSVs
              <br />
              HERE
            </span>
            <span className="poster-small">no upload · no signup · no SQL needed</span>
          </span>
        </button>
        <a className="scroll-cue" href="#watch">
          see it work ↓
        </a>
      </section>

      {/* 2. Ticker */}
      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className={i % 2 ? "tk-pink" : "tk-blue"}>
              “{t}” <b>✦</b>
            </span>
          ))}
        </div>
      </div>

      {/* 3. Live demo */}
      <Reveal className="band">
        <div className="band-head" id="watch">
          <p className="section-no">02 — Watch it work</p>
          <h3 className="section-title">
            A question goes in.
            <br />
            <span className="hl-pink">SQL and a chart come out.</span>
          </h3>
          <p className="section-text">This is a real answer from the sample data: 30,600 chai orders, queried in about 10 milliseconds.</p>
        </div>
        <LiveDemo />
      </Reveal>

      {/* 4. Three steps */}
      <Reveal className="band steps-band">
        <p className="section-no">03 — How it goes</p>
        <ol className="steps">
          <li>
            <b>01</b>
            <h4>Drop files</h4>
            <p>Each file becomes a table. Columns show up as chips you can click to add to your question.</p>
          </li>
          <li>
            <b>02</b>
            <h4>Ask in English</h4>
            <p>Ask like you’d ask a colleague. Follow up with “now only Pune” and Buddy builds on the last answer.</p>
          </li>
          <li>
            <b>03</b>
            <h4>Read, tweak, chart</h4>
            <p>Every query is printed next to its chart. Edit it, run it again, or download the result.</p>
          </li>
        </ol>
      </Reveal>

      {/* 5. Example questions */}
      <Reveal className="band">
        <div className="band-head">
          <p className="section-no">04 — Things people ask</p>
          <h3 className="section-title">Ask like you talk.</h3>
          <p className="section-text">Each question becomes one SQL query. Here’s the key line Buddy writes for each.</p>
        </div>
        <ul className="clips">
          {EXAMPLES.map((e, i) => (
            <Reveal as="li" key={e.q} className="clip" delay={i * 70}>
              <p className="clip-q">“{e.q}”</p>
              <code className="clip-sql">{e.sql}</code>
              <MiniChart type={e.chart} />
            </Reveal>
          ))}
        </ul>
      </Reveal>

      {/* 6. Privacy */}
      <Reveal className="band privacy">
        <div className="band-head">
          <p className="section-no">05 — What stays, what goes</p>
          <h3 className="section-title">
            Your rows stay home.
            <br />
            <span className="hl-pink">Only the column names travel.</span>
          </h3>
        </div>
        <div className="split">
          <div className="panel panel-stay">
            <p className="panel-tag">STAYS IN YOUR TAB</p>
            <div className="ghost-scroll">
            <table className="ghost-table" aria-label="Example rows that stay in your browser">
              <thead>
                <tr>
                  <th>order_date</th>
                  <th>outlet</th>
                  <th>item</th>
                  <th>amount</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["2026-10-29", "FC Road", "Masala Chai", "60"],
                  ["2026-10-29", "Hinjewadi", "Vada Pav", "25"],
                  ["2026-10-29", "Bandra West", "Cold Coffee", "180"],
                  ["2026-10-28", "Indiranagar", "Bun Maska", "35"],
                  ["…", "…", "…", "…"],
                ].map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <p className="panel-note">30,600 rows · read and queried by DuckDB, right in the browser</p>
          </div>
          <div className="arrow" aria-hidden="true">
            →
          </div>
          <div className="panel panel-go">
            <p className="panel-tag">GOES TO THE AI</p>
            <ul className="go-cols">
              {["order_date · DATE", "outlet · e.g. FC Road", "item · e.g. Masala Chai", "amount · 20 .. 540"].map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="panel-note">column names, types and a few example values — enough to write the SQL</p>
          </div>
        </div>
      </Reveal>

      {/* 7. Charts */}
      <Reveal className="band">
        <div className="band-head">
          <p className="section-no">06 — Five ways to draw an answer</p>
          <h3 className="section-title">Buddy picks the chart.</h3>
          <p className="section-text">It reads the shape of the result and chooses. Switch to the table any time.</p>
        </div>
        <ul className="charts">
          {CHARTS.map((c, i) => (
            <Reveal as="li" key={c.name} className="chart-card" delay={i * 70}>
              <MiniChart type={c.type} />
              <h4>{c.name}</h4>
              <p>{c.when}</p>
            </Reveal>
          ))}
        </ul>
      </Reveal>

      {/* 8. FAQ */}
      <Reveal className="band faq-band">
        <div className="band-head">
          <p className="section-no">07 — Questions about the questions</p>
          <h3 className="section-title">Good to know.</h3>
        </div>
        <div className="faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </Reveal>

      {/* 9. Closing call to action */}
      <Reveal className="cta">
        <div className="cta-inner">
          <span className="cta-sticker">
            <Buddy size={92} />
          </span>
          <h3 className="cta-title">
            Got a CSV?
            <br />
            <span className="hl">Ask it something.</span>
          </h3>
          {actions}
        </div>
      </Reveal>
    </main>
  );
}
