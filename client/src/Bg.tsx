import { useEffect, useRef } from "react";

// Landing page background (charte, annexe C): sand lines rippled by the wind, one saffron line in
// six, 36 drifting grains, a slight shift on scroll. Slow, never in front. Still with
// prefers-reduced-motion. In the dark theme the lines are sand on umber instead of umber on sand.
const GAP = 34;

export default function Bg({ dark = false }: { dark?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(devicePixelRatio, 2);
    const line = dark ? "rgba(243,235,221,.07)" : "rgba(42,27,18,.075)";
    const grain = dark ? "rgba(243,235,221,.22)" : "rgba(42,27,18,.22)";
    let w = 0, h = 0, raf = 0;
    const grains = Array.from({ length: 36 }, () => ({ x: Math.random(), y: Math.random(), v: Math.random() * 0.00006 + 0.00002, p: Math.random() * 6 }));
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const sy = still ? 0 : (scrollY * 0.06) % GAP;
      const n = Math.ceil(h / GAP) + 2;
      for (let i = 0; i < n; i++) {
        const y0 = i * GAP - sy;
        ctx.beginPath();
        for (let px = 0; px <= w + 14; px += 14) ctx.lineTo(px, y0 + 12 * Math.sin(px * 0.0045 + t * 0.00025 + i * 0.45) + 7 * Math.sin(px * 0.012 - t * 0.0004 + i * 1.3));
        const sun = i % 6 === 0;
        ctx.strokeStyle = sun ? "rgba(242,161,4,.3)" : line;
        ctx.lineWidth = sun ? 1.6 : 1.2;
        ctx.stroke();
      }
      ctx.fillStyle = grain;
      for (const g of grains) {
        if (!still) g.x = (g.x + g.v * 16) % 1.02;
        ctx.fillRect(g.x * w, g.y * h + Math.sin(t / 1800 + g.p) * 6, 1.6, 1.6);
      }
    };
    const size = () => {
      w = innerWidth; h = innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (still) draw(3000);
    };
    const loop = (t: number) => { draw(t); raf = requestAnimationFrame(loop); };
    size();
    addEventListener("resize", size);
    if (!still) raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", size); };
  }, [dark]);
  return <canvas ref={ref} className="cl-bg" aria-hidden="true" />;
}
