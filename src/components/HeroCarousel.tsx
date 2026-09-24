"use client";

import { useEffect, useState } from "react";
import { AlertIcon, ChartIcon, TraceIcon } from "./Icons";

const SLIDES = [
  {
    title: "Ерте ескерту",
    text: "2 сағатта 3+ оқушыда белгі — СЭС-ке бірден қызыл дабыл",
    bg: "bg-sky-accent",
    Icon: AlertIcon,
  },
  {
    title: "Партияны қадағалау",
    text: "Сол партияны алған басқа мектептер, балабақшалар мен асханалар бірден анықталады",
    bg: "bg-brand-600",
    Icon: TraceIcon,
  },
  {
    title: "Тәуекел балы",
    text: "Әр нысанға 0–100 балл: кенет тексеруді қайдан бастау керегі көрінеді",
    bg: "bg-sky-accent-dark",
    Icon: ChartIcon,
  },
];

const INTERVAL_MS = 4500;

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = SLIDES.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % n), INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused, n]);

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative h-52 sm:h-56 overflow-hidden">
        {SLIDES.map((slide, i) => {
          // -1 = сол жақта, 0 = ортада, 1 = оң жақта
          let offset = (i - index + n) % n;
          if (offset > n / 2) offset -= n;
          const isCenter = offset === 0;
          return (
            <button
              key={slide.title}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={slide.title}
              className={`absolute top-1/2 left-1/2 w-[78%] sm:w-[56%] h-40 sm:h-44 rounded-lg text-left text-white p-5 sm:p-6 flex items-center justify-between gap-4 transition-all duration-500 ease-out ${slide.bg}`}
              style={{
                transform: `translate(calc(-50% + ${offset * 72}%), -50%) scale(${isCenter ? 1 : 0.82})`,
                opacity: Math.abs(offset) > 1 ? 0 : isCenter ? 1 : 0.55,
                zIndex: isCenter ? 2 : 1,
              }}
            >
              <div className="space-y-2">
                <p className="text-lg sm:text-xl font-semibold">{slide.title}</p>
                <p className="text-sm text-white/85 max-w-xs">{slide.text}</p>
              </div>
              <div className={`shrink-0 bg-white rounded-lg p-3 ${isCenter ? "anim-float" : ""}`}>
                <slide.Icon className="w-10 h-10" />
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setIndex((i) => (i - 1 + n) % n)}
          aria-label="Алдыңғы"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/80 text-ink hover:bg-white"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => setIndex((i) => (i + 1) % n)}
          aria-label="Келесі"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/80 text-ink hover:bg-white"
        >
          ›
        </button>
      </div>

      <div className="flex justify-center gap-2 mt-4">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`${i + 1}-слайд`}
            className={`h-1 rounded-full transition-all duration-300 ${i === index ? "w-8 bg-slate-500" : "w-8 bg-slate-300"}`}
          />
        ))}
      </div>
    </div>
  );
}
