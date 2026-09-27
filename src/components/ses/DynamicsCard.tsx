"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { THEME } from "@/lib/theme";
import type { Stats } from "./types";
import { dayMonth } from "@/lib/format";

const fmt = (iso: string) => dayMonth(`${iso}T00:00:00`);

export function DynamicsCard({ dynamics }: { dynamics: Stats["dynamics"] }) {
  const data = dynamics.map((d, i) => ({ ...d, label: i === dynamics.length - 1 ? "бүгін" : fmt(d.date) }));

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[17px] font-semibold text-ink">Тәуекел динамикасы</h2>
        <span className="text-xs text-muted">соңғы 30 күн</span>
      </div>
      <div className="flex gap-4 text-xs text-muted mb-2">
        <span className="flex items-center gap-1.5"><i className="inline-block w-4 h-0.5 bg-warn-500" /> Сары нысандар</span>
        <span className="flex items-center gap-1.5"><i className="inline-block w-4 h-0.5 bg-bad-600" /> Қызыл нысандар</span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke={THEME.grid} vertical={false} />
            <XAxis
              dataKey="label"
              fontSize={11}
              tick={{ fill: THEME.tick }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              ticks={[data[0]?.label, data[data.length - 1]?.label].filter(Boolean) as string[]}
            />
            <YAxis allowDecimals={false} fontSize={11} tick={{ fill: THEME.tick }} tickLine={false} axisLine={false} />
            <Tooltip {...THEME.tooltip} formatter={(value, name) => [value, name === "yellow" ? "Сары" : "Қызыл"]} />
            <Line type="linear" dataKey="yellow" stroke={THEME.yellow} strokeWidth={2} dot={false} isAnimationActive />
            <Line type="linear" dataKey="red" stroke={THEME.red} strokeWidth={2} dot={{ r: 0 }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
