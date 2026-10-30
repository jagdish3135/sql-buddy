// Hand-drawn SVG charts in two "riso inks": each mark is printed in blue with a
// slightly misregistered pink layer underneath, like a two-colour risograph print.
import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { QueryResult } from "../lib/db";
import type { ChartSpec } from "../lib/chart";
import { fmtDate, fmtNumber, fmtValue, niceTicks } from "../lib/format";

interface Props {
  spec: ChartSpec;
  result: QueryResult;
}

const OFF = 3; // misregistration offset in px

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function Chart({ spec, result }: Props) {
  const [ref, width] = useWidth();
  return (
    <div className="chart" ref={ref}>
      {spec.type === "number" && <BigNumber spec={spec} result={result} />}
      {spec.type === "bar" && <Bars spec={spec} result={result} width={width} />}
      {spec.type === "line" && <Line spec={spec} result={result} width={width} />}
      {spec.type === "scatter" && <Scatter spec={spec} result={result} width={width} />}
    </div>
  );
}

function BigNumber({ spec, result }: Props) {
  const row = result.rows[0] ?? {};
  const nums = result.columns.filter((c) => c.kind === "number");
  const main = nums.find((c) => c.name === spec.y) ?? nums[0];
  const others = result.columns.filter((c) => c !== main);
  const v = row[main?.name ?? ""];
  return (
    <div className="bignum">
      <div className="bignum-value" data-text={fmtValue(v)}>
        {fmtValue(v)}
      </div>
      <div className="bignum-label">{main?.name.replace(/_/g, " ")}</div>
      {others.length > 0 && (
        <dl className="bignum-others">
          {others.map((c) => (
            <div key={c.name}>
              <dt>{c.name.replace(/_/g, " ")}</dt>
              <dd>{fmtValue(row[c.name])}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function Tip({ x, y, label, value, width }: { x: number; y: number; label: string; value: string; width: number }) {
  const w = Math.max(label.length, value.length) * 7.4 + 22;
  const left = Math.min(Math.max(x - w / 2, 4), width - w - 4);
  return (
    <g className="tip" transform={`translate(${left},${Math.max(y - 52, 2)})`} pointerEvents="none">
      <rect width={w} height={42} rx={2} />
      <text x={11} y={17} className="tip-label">
        {label}
      </text>
      <text x={11} y={33} className="tip-value">
        {value}
      </text>
    </g>
  );
}

function labelOf(v: unknown, unit?: string): string {
  if (v instanceof Date) return fmtDate(v, unit);
  return fmtValue(v);
}

function Bars({ spec, result, width }: Props & { width: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = result.rows.slice(0, 60).map((r) => ({ label: labelOf(r[spec.x!]), value: Number(r[spec.y!]) || 0 }));
  const longest = Math.max(...data.map((d) => d.label.length));
  const horizontal = data.length > 10 || longest * data.length * 7 > width * 0.9;

  const min = Math.min(0, ...data.map((d) => d.value));
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(min, max, 5);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];

  if (horizontal) {
    const labelW = Math.min(Math.max(longest * 7.2 + 14, 60), width * 0.38);
    const rowH = 26;
    const top = 26;
    const height = top + data.length * rowH + 8;
    const plotW = width - labelW - 58; // room for the value label after each bar
    const sx = (v: number) => labelW + ((v - lo) / (hi - lo)) * plotW;
    return (
      <svg width={width} height={height} role="img" aria-label={`Bar chart of ${spec.y} by ${spec.x}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={sx(t)} x2={sx(t)} y1={top - 6} y2={height - 8} />
            <text className="tick" x={sx(t)} y={14} textAnchor="middle">
              {fmtNumber(t, true)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const y = top + i * rowH + 4;
          const x0 = sx(Math.min(0, d.value));
          const w = Math.max(1, Math.abs(sx(d.value) - sx(0)));
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={hover === i ? "on" : ""}>
              <rect className="hit" x={0} y={y - 4} width={width} height={rowH} />
              <text className="cat" x={labelW - 10} y={y + rowH / 2 - 1} textAnchor="end">
                {d.label.length > labelW / 7 ? d.label.slice(0, Math.floor(labelW / 7) - 1) + "…" : d.label}
              </text>
              <rect className="ink-pink" x={x0 + OFF} y={y - OFF + 2} width={w} height={rowH - 10} />
              <rect className="ink-blue" x={x0} y={y + 2} width={w} height={rowH - 10} style={{ animationDelay: `${i * 25}ms` }} />
              <text className="val" x={x0 + w + 6} y={y + rowH / 2 - 1}>
                {hover === i || data.length <= 12 ? fmtNumber(d.value, true) : ""}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  const height = 300;
  const padL = 52;
  const padB = 46;
  const padT = 18;
  const plotW = width - padL - 10;
  const plotH = height - padB - padT;
  const sy = (v: number) => padT + plotH - ((v - lo) / (hi - lo)) * plotH;
  const band = plotW / data.length;
  const bw = Math.min(band * 0.66, 72);
  return (
    <svg width={width} height={height} role="img" aria-label={`Bar chart of ${spec.y} by ${spec.x}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={padL} x2={width - 8} y1={sy(t)} y2={sy(t)} />
          <text className="tick" x={padL - 8} y={sy(t) + 4} textAnchor="end">
            {fmtNumber(t, true)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = padL + i * band + (band - bw) / 2;
        const y = sy(Math.max(0, d.value));
        const h = Math.max(1, Math.abs(sy(d.value) - sy(0)));
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={hover === i ? "on" : ""}>
            <rect className="hit" x={padL + i * band} y={padT} width={band} height={plotH} />
            <rect className="ink-pink" x={x + OFF} y={y - OFF} width={bw} height={h} />
            <rect className="ink-blue grow" x={x} y={y} width={bw} height={h} style={{ animationDelay: `${i * 35}ms` }} />
            <text className="cat" x={x + bw / 2} y={height - padB + 18} textAnchor="middle">
              {d.label.length > band / 6.5 ? d.label.slice(0, Math.max(3, Math.floor(band / 6.5) - 1)) + "…" : d.label}
            </text>
          </g>
        );
      })}
      <line className="axis" x1={padL} x2={width - 8} y1={sy(0)} y2={sy(0)} />
      {hover !== null && (
        <Tip x={padL + hover * band + band / 2} y={sy(Math.max(0, data[hover].value))} label={data[hover].label} value={fmtNumber(data[hover].value)} width={width} />
      )}
    </svg>
  );
}

function Line({ spec, result, width }: Props & { width: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const xCol = result.columns.find((c) => c.name === spec.x);
  const isDate = xCol?.kind === "date";
  const isNum = xCol?.kind === "number";
  const data = useMemo(() => {
    const rows = result.rows.map((r) => ({ raw: r[spec.x!], value: Number(r[spec.y!]) || 0 }));
    if (isDate) rows.sort((a, b) => (a.raw as Date).getTime() - (b.raw as Date).getTime());
    else if (isNum) rows.sort((a, b) => Number(a.raw) - Number(b.raw));
    return rows;
  }, [result, spec.x, spec.y, isDate, isNum]);

  // Guess the bucket size from the spacing between dates, for nicer labels.
  const unit = useMemo(() => {
    if (!isDate || data.length < 2) return undefined;
    const gap = ((data[1].raw as Date).getTime() - (data[0].raw as Date).getTime()) / 86400000;
    return gap >= 360 ? "year" : gap >= 28 ? "month" : gap >= 7 ? "week" : "day";
  }, [data, isDate]);

  const height = 300;
  const padL = 52;
  const padB = 40;
  const padT = 18;
  const padR = 16;
  const plotW = width - padL - padR;
  const plotH = height - padB - padT;
  const ticks = niceTicks(Math.min(0, ...data.map((d) => d.value)), Math.max(...data.map((d) => d.value)), 5);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const xs = (i: number) => {
    if (isDate || isNum) {
      const v = (d: (typeof data)[number]) => (isDate ? (d.raw as Date).getTime() : Number(d.raw));
      const a = v(data[0]);
      const b = v(data[data.length - 1]);
      return padL + (b === a ? plotW / 2 : ((v(data[i]) - a) / (b - a)) * plotW);
    }
    return padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  };
  const sy = (v: number) => padT + plotH - ((v - lo) / (hi - lo)) * plotH;
  const path = data.map((d, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${sy(d.value).toFixed(1)}`).join("");
  const area = `${path}L${xs(data.length - 1).toFixed(1)},${sy(Math.max(lo, 0))}L${xs(0).toFixed(1)},${sy(Math.max(lo, 0))}Z`;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotW / 86))));

  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left + padL;
    let best = 0;
    data.forEach((_, i) => Math.abs(xs(i) - x) < Math.abs(xs(best) - x) && (best = i));
    setHover(best);
  };

  return (
    <svg width={width} height={height} role="img" aria-label={`Line chart of ${spec.y} over ${spec.x}`}>
      <defs>
        <pattern id="halftone" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
          <circle cx="3" cy="3" r="1.3" className="dot" />
        </pattern>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={padL} x2={width - padR} y1={sy(t)} y2={sy(t)} />
          <text className="tick" x={padL - 8} y={sy(t) + 4} textAnchor="end">
            {fmtNumber(t, true)}
          </text>
        </g>
      ))}
      {data.map((d, i) =>
        i % labelEvery === 0 || i === data.length - 1 ? (
          <text key={i} className="cat" x={xs(i)} y={height - padB + 20} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}>
            {labelOf(d.raw, unit)}
          </text>
        ) : null,
      )}
      <path d={area} fill="url(#halftone)" className="area" />
      <path d={path} className="line-pink" transform={`translate(${OFF},${-OFF})`} />
      <path d={path} className="line-blue draw" pathLength={1} />
      {data.length <= 40 && data.map((d, i) => <circle key={i} className="pt" cx={xs(i)} cy={sy(d.value)} r={3} />)}
      <line className="axis" x1={padL} x2={width - padR} y1={sy(Math.max(lo, 0))} y2={sy(Math.max(lo, 0))} />
      <rect className="hit" x={padL} y={padT} width={plotW} height={plotH} onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      {hover !== null && (
        <>
          <line className="cross" x1={xs(hover)} x2={xs(hover)} y1={padT} y2={padT + plotH} />
          <circle className="pt on" cx={xs(hover)} cy={sy(data[hover].value)} r={5} />
          <Tip x={xs(hover)} y={sy(data[hover].value)} label={labelOf(data[hover].raw, unit)} value={fmtNumber(data[hover].value)} width={width} />
        </>
      )}
    </svg>
  );
}

function Scatter({ spec, result, width }: Props & { width: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const label = result.columns.find((c) => c.kind === "text")?.name;
  const data = result.rows.map((r) => ({ x: Number(r[spec.x!]) || 0, y: Number(r[spec.y!]) || 0, label: label ? String(r[label]) : "" }));
  const height = 320;
  const padL = 52;
  const padB = 44;
  const padT = 16;
  const padR = 16;
  const xt = niceTicks(Math.min(...data.map((d) => d.x)), Math.max(...data.map((d) => d.x)), 6);
  const yt = niceTicks(Math.min(...data.map((d) => d.y)), Math.max(...data.map((d) => d.y)), 5);
  const sx = (v: number) => padL + ((v - xt[0]) / (xt[xt.length - 1] - xt[0])) * (width - padL - padR);
  const sy = (v: number) => padT + (height - padT - padB) - ((v - yt[0]) / (yt[yt.length - 1] - yt[0])) * (height - padT - padB);
  return (
    <svg width={width} height={height} role="img" aria-label={`Scatter of ${spec.y} against ${spec.x}`}>
      {yt.map((t) => (
        <g key={`y${t}`}>
          <line className="grid" x1={padL} x2={width - padR} y1={sy(t)} y2={sy(t)} />
          <text className="tick" x={padL - 8} y={sy(t) + 4} textAnchor="end">
            {fmtNumber(t, true)}
          </text>
        </g>
      ))}
      {xt.map((t) => (
        <text key={`x${t}`} className="tick" x={sx(t)} y={height - padB + 20} textAnchor="middle">
          {fmtNumber(t, true)}
        </text>
      ))}
      <text className="axis-title" x={width - padR} y={height - 6} textAnchor="end">
        {spec.x} →
      </text>
      <text className="axis-title" x={padL} y={padT - 4}>
        ↑ {spec.y}
      </text>
      {data.map((d, i) => (
        <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          <circle className="ink-pink" cx={sx(d.x) + OFF} cy={sy(d.y) - OFF} r={6} />
          <circle className="ink-blue" cx={sx(d.x)} cy={sy(d.y)} r={6} />
        </g>
      ))}
      {hover !== null && (
        <Tip
          x={sx(data[hover].x)}
          y={sy(data[hover].y)}
          label={data[hover].label || `${spec.x} ${fmtNumber(data[hover].x)}`}
          value={`${fmtNumber(data[hover].y)} · ${fmtNumber(data[hover].x)}`}
          width={width}
        />
      )}
    </svg>
  );
}
