"use client";

import { useState } from "react";
import Link from "next/link";
import { LevelPill } from "@/components/ui";
import { alertText } from "@/lib/alertText";
import { placeLabel, relativeTime, shortName } from "@/lib/format";
import { useLocale, useT } from "@/i18n/client";
import type { OverviewAlert } from "./types";

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
  const t = useT();
  const locale = useLocale();
  const a = t.ses.alerts;
  const [filter, setFilter] = useState<"ALL" | "RED" | "YELLOW">("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  // Ашық қызыл алерттер әрқашан жоғарыда (олардан таралған сары алерттер бір сәт кейін жасалады).
  const urgent = (x: OverviewAlert) => (x.level === "RED" && x.status !== "CLOSED" ? 0 : 1);
  const visible = alerts
    .filter((x) => filter === "ALL" || x.level === filter)
    .sort((x, y) => urgent(x) - urgent(y) || y.createdAt.localeCompare(x.createdAt));
  // Партиядан таралған алерт мәтінінде бастапқы нысанның атауы тізімнің өзінен алынады.
  const sourceName = (schoolId: string) => {
    const s = alerts.find((x) => x.school.id === schoolId)?.school;
    return s ? shortName(s.name, s.kind, locale) : null;
  };

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
    <section className={`card flex min-h-0 flex-col p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-semibold text-ink">{a.title}</h2>
        <div className="seg" role="group" aria-label={a.filterAria}>
          {(
            [
              ["ALL", a.all],
              ["RED", a.red],
              ["YELLOW", a.yellow],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {visible.length === 0 && <p className="text-sm text-muted">{a.empty}</p>}
        {visible.map((x) => {
          const red = x.level === "RED";
          const title = `${shortName(x.school.name, x.school.kind, locale)} · ${placeLabel(x.school.district.name, x.school.address, locale)}`;
          const body = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2">
                  <LevelPill level={x.level} />
                  {x.rule && t.rules.names[x.rule] && <span className="chip text-xs">{t.rules.names[x.rule]}</span>}
                </span>
                <span className={`shrink-0 font-mono text-xs ${red && x.status === "OPEN" ? "text-bad-700" : "text-muted"}`}>
                  {relativeTime(x.createdAt, locale)} · {t.alertStatusShort[x.status]}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-ink" title={x.school.name}>
                {title}
              </p>
              <p className="mt-1 text-sm text-muted">
                {alertText(x, t, locale, sourceName)}
                {red && x.tracedCount > 0 && `. ${a.traced(x.tracedCount)}`}
              </p>
            </>
          );

          return red && x.status !== "CLOSED" ? (
            <article key={x.id} className="anim-slide-in rounded-xl border border-bad-300 bg-bad-50 p-4">
              {body}
              <div className={`mt-3 flex flex-wrap gap-2 ${readOnly ? "hidden" : ""}`}>
                <Link href={`/ses/alerts/${x.id}`} className="btn btn-primary btn-sm">
                  {a.open}
                </Link>
                {x.status === "OPEN" && (
                  <button type="button" className="btn btn-outline btn-sm" disabled={busy === x.id} onClick={() => acknowledge(x.id)}>
                    {busy === x.id ? "…" : a.acknowledge}
                  </button>
                )}
              </div>
            </article>
          ) : readOnly ? (
            <article key={x.id} className="rounded-xl border border-line p-4">
              {body}
            </article>
          ) : (
            <Link key={x.id} href={`/ses/alerts/${x.id}`} className="tile block rounded-xl border border-line p-4">
              {body}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
