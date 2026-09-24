"use client";

import { useState } from "react";
import { hm, shortName } from "@/lib/format";
import type { OverviewSchool, Stats } from "./types";

const TYPE_TEXT: Record<string, string> = {
  MONITORING: "мониторингтік сапар",
  UNANNOUNCED: "кенет тексеру",
  UNSCHEDULED: "жоспардан тыс",
};

function defaultTime() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(Math.min(d.getHours() + 1, 23));
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

function PlanForm({ schools, onDone, onCancel }: { schools: OverviewSchool[]; onDone: () => void; onCancel: () => void }) {
  const flagged = schools.filter((s) => s.riskLevel !== "GREEN");
  const others = schools.filter((s) => s.riskLevel === "GREEN").sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const [schoolId, setSchoolId] = useState(flagged[0]?.id ?? others[0]?.id ?? "");
  const [type, setType] = useState("UNANNOUNCED");
  const [time, setTime] = useState(defaultTime);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const [h, m] = time.split(":").map(Number);
    const plannedAt = new Date();
    plannedAt.setHours(h, m, 0, 0);
    setSaving(true);
    try {
      await fetch("/api/ses/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, type, plannedAt: plannedAt.toISOString() }),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  const label = (s: OverviewSchool) => `${shortName(s.name, s.kind)} — ${s.district.name}`;

  return (
    <form onSubmit={submit} className="anim-slide-down mb-4 space-y-2 rounded-lg border border-line bg-page p-3">
      <select className="field" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} aria-label="Нысан">
        {flagged.length > 0 && (
          <optgroup label="Кенет тексеруге ұсынылады">
            {flagged.map((s) => (
              <option key={s.id} value={s.id}>{label(s)}</option>
            ))}
          </optgroup>
        )}
        <optgroup label="Барлық нысандар">
          {others.map((s) => (
            <option key={s.id} value={s.id}>{label(s)}</option>
          ))}
        </optgroup>
      </select>
      <div className="grid grid-cols-[1fr_110px] gap-2">
        <select className="field" value={type} onChange={(e) => setType(e.target.value)} aria-label="Тексеру түрі">
          <option value="UNANNOUNCED">Кенет тексеру</option>
          <option value="MONITORING">Мониторингтік сапар</option>
          <option value="UNSCHEDULED">Жоспардан тыс</option>
        </select>
        <input type="time" className="field font-mono" value={time} onChange={(e) => setTime(e.target.value)} required aria-label="Уақыты" />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Болдырмау</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !schoolId}>
          {saving ? "..." : "Жоспарлау"}
        </button>
      </div>
    </form>
  );
}

export function TodayInspectionsCard({
  inspections,
  prescriptions,
  schools,
  onChanged,
  readOnly = false,
}: {
  inspections: Stats["inspections"];
  prescriptions: Stats["prescriptions"];
  schools: OverviewSchool[];
  onChanged?: () => void;
  readOnly?: boolean;
}) {
  const [planning, setPlanning] = useState(false);

  return (
    <section className="card p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-[17px] font-semibold text-ink">Бүгінгі тексерулер</h2>
        {!readOnly && !planning && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setPlanning(true)}>
            Тексеру жоспарлау
          </button>
        )}
      </div>

      {planning && (
        <PlanForm
          schools={schools}
          onCancel={() => setPlanning(false)}
          onDone={() => {
            setPlanning(false);
            onChanged?.();
          }}
        />
      )}

      <div className="flex-1 space-y-3">
        {inspections.length === 0 && <p className="text-sm text-muted">Бүгінге тексеру жоспарланбаған.</p>}
        {inspections.map((i) => {
          const urgent = !i.doneAt && i.school.riskLevel === "RED";
          return (
            <div key={i.id} className="grid grid-cols-[52px_1fr] gap-3">
              <span className={`font-mono text-sm ${urgent ? "text-bad-600 font-medium" : "text-muted"}`}>{hm(i.plannedAt)}</span>
              <div>
                <p className="text-sm font-semibold text-ink" title={i.school.name}>
                  {shortName(i.school.name, i.school.kind)} · {TYPE_TEXT[i.type]}
                </p>
                <p className="text-sm text-muted">
                  {i.doneAt
                    ? `Орындалды · ${i.result ?? "нәтиже енгізілмеген"}`
                    : urgent
                      ? "Қызыл алерт бойынша · сынама алу"
                      : "Жоспарланған"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
        <div>
          <p className="text-xs text-muted">Ашық нұсқама</p>
          <p className="text-xl font-semibold tabular-nums text-ink">{prescriptions.open}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Тексеруде</p>
          <p className="text-xl font-semibold tabular-nums text-ink">{prescriptions.submitted}</p>
        </div>
        <div>
          <p className={`text-xs ${prescriptions.overdue > 0 ? "text-bad-600" : "text-muted"}`}>Мерзімі өткен</p>
          <p className={`text-xl font-semibold tabular-nums ${prescriptions.overdue > 0 ? "text-bad-600" : "text-ink"}`}>
            {prescriptions.overdue}
          </p>
        </div>
      </div>
    </section>
  );
}
