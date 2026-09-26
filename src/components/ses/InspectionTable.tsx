"use client";

import { useState } from "react";
import Link from "next/link";
import { LevelPill } from "@/components/ui";
import { FACILITY_KIND_LABEL } from "@/lib/risk/labels";
import { daysSince, hm, placeLabel, shortName } from "@/lib/format";
import type { Unannounced } from "./types";

/** Келесі толық сағат (түн ортасынан асса — 5 минуттан кейін), бүгінгі тексерулерге түсуі үшін. */
function nextSlot() {
  const now = new Date();
  const slot = new Date(now);
  slot.setMinutes(0, 0, 0);
  slot.setHours(slot.getHours() + 1);
  return slot.getDate() === now.getDate() ? slot : new Date(now.getTime() + 5 * 60_000);
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M12 21s-6-5.3-6-11a6 6 0 1 1 12 0c0 5.7-6 11-6 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}

export function InspectionTable({
  rows,
  onChanged,
  onShowOnMap,
  readOnly = false,
}: {
  rows: Unannounced[];
  onChanged?: () => void;
  onShowOnMap?: (row: Unannounced) => void;
  readOnly?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function assign(row: Unannounced) {
    setBusy(row.id);
    try {
      await fetch("/api/ses/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: row.id, type: "UNANNOUNCED", plannedAt: nextSlot().toISOString() }),
      });
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-[17px] font-semibold text-ink">Кенет тексеруге ұсынылады</h2>
        <p className="text-xs text-muted">Тәуекел балы бойынша сұрыпталған · шешімді инспектор қабылдайды</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted py-4">Қазір сары немесе қызыл нысан жоқ.</p>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="table-head text-left border-b border-line">
                <th className="py-2 pr-3 font-medium">Нысан</th>
                <th className="py-2 pr-3 font-medium">Аудан</th>
                <th className="py-2 pr-3 font-medium">Балл</th>
                <th className="py-2 pr-3 font-medium">Деңгей</th>
                <th className="py-2 pr-3 font-medium">Негізгі себеп</th>
                <th className="py-2 pr-3 font-medium">Соңғы тексеру</th>
                {!readOnly && <th className="py-2 font-medium">Әрекет</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0 align-middle">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-1.5">
                      {readOnly ? (
                        <span className="font-semibold text-ink" title={row.name}>{shortName(row.name, row.kind)}</span>
                      ) : (
                        <Link href={`/ses/school/${row.id}`} className="font-semibold text-ink hover:text-primary" title={row.name}>
                          {shortName(row.name, row.kind)}
                        </Link>
                      )}
                      {onShowOnMap && (
                        <button
                          type="button"
                          onClick={() => onShowOnMap(row)}
                          className="text-muted hover:text-primary"
                          aria-label="Картада көрсету"
                          title="Картада көрсету"
                        >
                          <PinIcon />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted">{FACILITY_KIND_LABEL[row.kind]}</p>
                  </td>
                  <td className="py-3 pr-3 text-ink">{placeLabel(row.district.name, row.address)}</td>
                  <td className="py-3 pr-3 font-mono tabular-nums">{row.riskScore}</td>
                  <td className="py-3 pr-3"><LevelPill level={row.riskLevel} /></td>
                  <td className="py-3 pr-3 text-ink">{row.reasons.join(" · ") || "—"}</td>
                  <td className="py-3 pr-3 text-muted whitespace-nowrap">{daysSince(row.lastInspectionAt)}</td>
                  {!readOnly && (
                    <td className="py-3 whitespace-nowrap">
                      {row.plannedInspectionAt ? (
                        <span className="text-xs font-medium text-ok-700">Тағайындалды · {hm(row.plannedInspectionAt)}</span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy === row.id}
                          onClick={() => assign(row)}
                          className={`btn btn-sm ${row.riskLevel === "RED" ? "btn-primary" : "btn-outline"}`}
                        >
                          {busy === row.id ? "..." : "Тексеру тағайындау"}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
