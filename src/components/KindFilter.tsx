"use client";

import { FACILITY_KIND_PLURAL } from "@/lib/risk/labels";

export type KindFilterValue = "ALL" | "SCHOOL" | "KINDERGARTEN" | "CANTEEN";

export function KindFilter({
  value,
  onChange,
  counts,
}: {
  value: KindFilterValue;
  onChange: (v: KindFilterValue) => void;
  counts: Partial<Record<KindFilterValue, number>>;
}) {
  const options = (["ALL", "SCHOOL", "KINDERGARTEN", "CANTEEN"] as const).filter((k) => k === "ALL" || counts[k]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`rounded-full px-3 py-1 text-sm border transition-colors ${
            value === k ? "bg-brand-600 border-brand-600 text-white" : "bg-white border-slate-300 text-ink hover:border-brand-500"
          }`}
        >
          {k === "ALL" ? "Барлығы" : FACILITY_KIND_PLURAL[k]} <span className="opacity-70">{counts[k] ?? 0}</span>
        </button>
      ))}
      <span className="ml-auto hidden sm:flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-full bg-slate-500" /> мектеп</span>
        <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-full border-2 border-slate-500" /> балабақша</span>
        <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-[2px] bg-slate-500" /> асхана</span>
      </span>
    </div>
  );
}

export function countByKind(items: { kind: string }[]) {
  const counts: Partial<Record<KindFilterValue, number>> = { ALL: items.length };
  for (const i of items) counts[i.kind as KindFilterValue] = (counts[i.kind as KindFilterValue] ?? 0) + 1;
  return counts;
}
