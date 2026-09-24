"use client";

import { useState } from "react";
import Link from "next/link";
import { LevelPill } from "@/components/ui";
import { placeLabel, relativeTime, shortName } from "@/lib/format";
import type { OverviewAlert } from "./types";

const STATUS: Record<string, string> = { OPEN: "ашық", ACKNOWLEDGED: "қабылданды", CLOSED: "жабық" };

export function AlertsPanel({
  alerts,
  onChanged,
  readOnly = false,
  className = "",
}: {
  alerts: OverviewAlert[];
  onChanged?: () => void;
  readOnly?: boolean;
  className?: string;
}) {
  const [filter, setFilter] = useState<"ALL" | "RED" | "YELLOW">("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  // Ашық қызыл алерттер әрқашан жоғарыда (олардан таралған сары алерттер бір сәт кейін жасалады).
  const urgent = (a: OverviewAlert) => (a.level === "RED" && a.status !== "CLOSED" ? 0 : 1);
  const visible = alerts
    .filter((a) => filter === "ALL" || a.level === filter)
    .sort((a, b) => urgent(a) - urgent(b) || b.createdAt.localeCompare(a.createdAt));

  async function acknowledge(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/ses/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge" }),
      });
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={`card p-5 flex flex-col min-h-0 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-[17px] font-semibold text-ink">Алерттер</h2>
        <div className="seg" role="group" aria-label="Алерт сүзгісі">
          {(
            [
              ["ALL", "Барлығы"],
              ["RED", "Қызыл"],
              ["YELLOW", "Сары"],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
        {visible.length === 0 && <p className="text-sm text-muted">Алерттер жоқ.</p>}
        {visible.map((a) => {
          const red = a.level === "RED";
          const title = `${shortName(a.school.name, a.school.kind)} · ${placeLabel(a.school.district.name, a.school.address)}`;
          const body = (
            <>
              <div className="flex items-center justify-between gap-2">
                <LevelPill level={a.level} />
                <span className={`font-mono text-xs ${red && a.status === "OPEN" ? "text-bad-600" : "text-muted"}`}>
                  {relativeTime(a.createdAt)} · {STATUS[a.status]}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-ink" title={a.school.name}>{title}</p>
              <p className="mt-1 text-sm text-muted">
                {a.reason}
                {red && a.tracedCount > 0 && `. Сол партия тағы ${a.tracedCount} нысанға жеткізілген`}
              </p>
            </>
          );

          return red && a.status !== "CLOSED" ? (
            <article key={a.id} className="anim-slide-in rounded-xl border border-bad-300 bg-bad-50 p-4">
              {body}
              <div className={`mt-3 flex flex-wrap gap-2 ${readOnly ? "hidden" : ""}`}>
                <Link href={`/ses/alerts/${a.id}`} className="btn btn-primary btn-sm">
                  Алертті ашу
                </Link>
                {a.status === "OPEN" && (
                  <button type="button" className="btn btn-outline btn-sm" disabled={busy === a.id} onClick={() => acknowledge(a.id)}>
                    {busy === a.id ? "..." : "Қабылдадым"}
                  </button>
                )}
              </div>
            </article>
          ) : readOnly ? (
            <article key={a.id} className="rounded-xl border border-line p-4">{body}</article>
          ) : (
            <Link key={a.id} href={`/ses/alerts/${a.id}`} className="tile block rounded-xl border border-line p-4">
              {body}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
