// Highlighter cursor: a chisel-tip marker whose tip is the exact pointer spot.
// It tilts a little with movement, swipes a highlight under buttons and links,
// writes [data-cursor] labels on a highlighted strip, pulls .btn buttons
// slightly toward it, and switches to pink ink on dark areas. It hides in text
// fields (normal I-beam) and is off on touch screens and with reduced motion.
import { useEffect, useRef, useState } from "react";

const CLICKABLE = "a, button, summary, label, select, [role='tab'], [data-cursor]";
const TEXT = "textarea, input, [contenteditable='true']";
const MAGNETIC = ".btn, [data-magnetic]";
// Dark backgrounds where yellow ink wouldn't read; the marker switches to pink.
const DARK = ".cta, .btn-ink, .receipt-head, .result-table th, .tip, .badge-claude, .badge-openai, .poster-small";

export function Cursor() {
  const [enabled] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const box = useRef<HTMLDivElement>(null);
  const pen = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const swipe = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.classList.add("has-cursor");
    const el = box.current!;
    let x = -100;
    let y = -100;
    let lastX = x;
    let lean = 0;
    let frame = 0;
    let magnet: HTMLElement | null = null;
    let target: HTMLElement | null = null;

    const set = (name: string, on: boolean) => el.classList.toggle(name, on);

    const releaseMagnet = () => {
      if (magnet) magnet.style.translate = "";
      magnet = null;
    };

    // Lay the highlight swipe just under the hovered element.
    const placeSwipe = (t: HTMLElement | null) => {
      const s = swipe.current!;
      if (!t) {
        s.classList.remove("on");
        return;
      }
      const r = t.getBoundingClientRect();
      s.style.left = `${r.left - 5}px`;
      s.style.top = `${r.bottom - 5}px`;
      s.style.width = `${r.width + 10}px`;
      s.classList.remove("on");
      void s.offsetWidth; // restart the swipe animation
      s.classList.add("on");
    };

    const tick = () => {
      // Lean the pen into the direction of travel, easing back when still.
      const goal = Math.max(-14, Math.min(14, (x - lastX) * 0.9));
      lean += (goal - lean) * 0.18;
      lastX = x;
      pen.current!.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      tilt.current!.style.rotate = `${lean.toFixed(2)}deg`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      set("is-away", false);
      if (magnet) {
        const b = magnet.getBoundingClientRect();
        magnet.style.translate = `${(x - (b.left + b.width / 2)) * 0.18}px ${(y - (b.top + b.height / 2)) * 0.28}px`;
      }
    };

    const onOver = (e: PointerEvent) => {
      const node = e.target as Element | null;
      if (!node?.closest) return;
      const inText = !!node.closest(TEXT);
      const hit = node.closest<HTMLElement>(CLICKABLE);
      const live = hit && !hit.matches(":disabled") && !inText ? hit : null;
      const text = node.closest<HTMLElement>("[data-cursor]")?.dataset.cursor ?? "";
      set("is-text", inText);
      set("is-dark", !!node.closest(DARK));
      set("is-hover", !!live);
      set("is-label", !!text && !inText);
      if (label.current) label.current.textContent = text;
      if (live !== target) {
        target = live;
        // Labelled areas (big panels) get the strip, not a swipe.
        placeSwipe(live && !text ? live : null);
      }
      const m = node.closest<HTMLElement>(MAGNETIC);
      if (m !== magnet) {
        releaseMagnet();
        if (m && !m.matches(":disabled")) magnet = m;
      }
    };

    const onDown = () => set("is-press", true);
    const onUp = () => set("is-press", false);
    const onScroll = () => {
      target = null;
      placeSwipe(null);
    };
    const onLeave = () => {
      set("is-away", true);
      releaseMagnet();
      onScroll();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      releaseMagnet();
      root.classList.remove("has-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div className="cursor is-away" ref={box} aria-hidden="true">
      <div className="hl-swipe" ref={swipe} />
      <div className="hl-pos" ref={pen}>
        <span className="hl-label" ref={label} />
        <div className="hl-tilt" ref={tilt}>
          {/* Drawn tip-down with the tip at (0,0), which sits on the pointer. */}
          <svg className="hl-pen" width="36" height="40" viewBox="-29 -38 36 40">
            <g transform="rotate(-35)">
              <g className="hl-plate" transform="translate(1.4,-1)">
                <rect x="-5" y="-38" width="10" height="27" rx="2" />
              </g>
              <rect className="hl-body" x="-5" y="-38" width="10" height="27" rx="2" />
              <rect className="hl-cap" x="-5" y="-38" width="10" height="7" rx="2" />
              <path className="hl-tip" d="M-5 -11h10l-2.2 10.2h-5.6z" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
