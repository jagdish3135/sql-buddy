// The mascot: a little database cylinder printed in two inks. Its eyes follow the
// pointer, it blinks, and it shows thought dots while working.
import { useEffect, useRef } from "react";

export function Buddy({ size = 64, thinking = false, mood = "happy" }: { size?: number; thinking?: boolean; mood?: "happy" | "oops" }) {
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const move = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 300) * 2.6;
      el.style.setProperty("--ex", `${(dx / d) * k}px`);
      el.style.setProperty("--ey", `${(dy / d) * k}px`);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  return (
    <svg ref={svg} className={`buddy${thinking ? " thinking" : ""}`} width={size} height={size * 1.11} viewBox="0 -10 72 80" aria-hidden="true">
      {/* pink plate, misregistered */}
      <g className="buddy-pink" transform="translate(3,-2)">
        <path d="M8 16v38c0 6 11 10 24 10s24-4 24-10V16" />
        <ellipse cx="32" cy="16" rx="24" ry="9" />
      </g>
      {/* blue plate */}
      <g className="buddy-blue">
        <path d="M8 16v38c0 6 11 10 24 10s24-4 24-10V16c0 5-11 9-24 9S8 21 8 16z" />
        <path className="buddy-band" d="M8 30c0 5 11 9 24 9s24-4 24-9" />
        <path className="buddy-band" d="M8 44c0 5 11 9 24 9s24-4 24-9" />
        <ellipse className="buddy-lid" cx="32" cy="16" rx="24" ry="9" />
      </g>
      <g className="buddy-face">
        <g className="buddy-eyes">
          <ellipse cx="24" cy="36" rx="3.2" ry="4" />
          <ellipse cx="40" cy="36" rx="3.2" ry="4" />
        </g>
        {mood === "happy" ? <path className="buddy-mouth" d="M27 46q5 4.5 10 0" /> : <path className="buddy-mouth" d="M27 49q5 -4 10 0" />}
        <circle className="buddy-cheek" cx="18" cy="44" r="2.6" />
        <circle className="buddy-cheek" cx="46" cy="44" r="2.6" />
      </g>
      <g className="buddy-dots">
        <circle cx="52" cy="4" r="2.2" />
        <circle cx="58" cy="-1" r="2.6" />
        <circle cx="64" cy="-7" r="3" />
      </g>
    </svg>
  );
}
