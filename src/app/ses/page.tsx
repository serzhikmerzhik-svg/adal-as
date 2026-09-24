"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import { KindFilter, countByKind, type KindFilterValue } from "@/components/KindFilter";
import type { MapSchool } from "@/components/map/shared";
import { ALERT_STATUS_LABEL, FACILITY_KIND_LABEL, LEVEL_BADGE, LEVEL_LABEL } from "@/lib/risk/labels";

const SchoolMap = dynamic(() => import("@/components/SchoolMap").then((m) => m.SchoolMap), { ssr: false });

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type OverviewSchool = MapSchool & { district: { name: string } };

type Alert = {
  id: string;
  level: "YELLOW" | "RED";
  reason: string;
  status: string;
  createdAt: string;
  school: { name: string };
};

export default function SesPage() {
  const { data } = useSWR("/api/ses/overview", fetcher, { refreshInterval: 5000 });
  const [toast, setToast] = useState<string | null>(null);
  const [kind, setKind] = useState<KindFilterValue>("ALL");
  const knownAlertIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data?.alerts) return;
    const ids: Alert[] = data.alerts;
    if (knownAlertIds.current === null) {
      knownAlertIds.current = new Set(ids.map((a) => a.id));
      return;
    }
    const fresh = ids.find((a) => a.level === "RED" && !knownAlertIds.current!.has(a.id));
    if (fresh) {
      setToast(`Жаңа қызыл дабыл: ${fresh.school.name}`);
      setTimeout(() => setToast(null), 6000);
    }
    knownAlertIds.current = new Set(ids.map((a) => a.id));
  }, [data]);

  if (!data) {
    return <div className="p-6 text-center text-slate-500">Жүктелуде...</div>;
  }

  const { schools, alerts, kpi, unannouncedList } = data as {
    schools: OverviewSchool[];
    alerts: Alert[];
    kpi: Record<string, number>;
    unannouncedList: OverviewSchool[];
  };
  const byKind = (list: OverviewSchool[]) => (kind === "ALL" ? list : list.filter((s) => s.kind === kind));
  const visibleSchools = byKind(schools);
  const visibleUnannounced = byKind(unannouncedList);

  return (
    <main className="min-h-screen pb-10">
      {toast && (
        <div className="anim-slide-in fixed top-20 right-4 z-[60] bg-red-600 text-white rounded-md px-4 py-3 shadow-lg max-w-xs">
          {toast}
        </div>
      )}

      <AppHeader subtitle="СЭС дашборды" />

      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Жасыл" value={kpi.green} color="border-brand-600 text-brand-700" />
          <KpiCard label="Сары" value={kpi.yellow} color="border-amber-500 text-amber-700" />
          <KpiCard label="Қызыл" value={kpi.red} color="border-red-600 text-red-700" />
          <KpiCard label="Ашық алерттер" value={kpi.openAlerts} color="border-sky-accent text-sky-accent-dark" />
          <KpiCard label="Мерзімі өткен нұсқама" value={kpi.overduePrescriptions} color="border-orange-500 text-orange-700" />
        </section>

        <KindFilter value={kind} onChange={setKind} counts={countByKind(schools)} />

        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-lg p-3 h-[420px]">
            <SchoolMap schools={visibleSchools} basePath="/ses/school" />
          </div>

          <div className="bg-white rounded-lg p-4 space-y-3 max-h-[420px] overflow-y-auto">
            <h2 className="font-bold text-ink">Алерттер лентасы</h2>
            {alerts.length === 0 && <p className="text-sm text-slate-500">Алерттер жоқ.</p>}
            {alerts.map((a: Alert) => (
              <Link
                key={a.id}
                href={`/ses/alerts/${a.id}`}
                className={`anim-slide-in block rounded-md p-3 border-l-4 ${a.level === "RED" ? "border-red-600 bg-red-50" : "border-amber-500 bg-amber-50"}`}
              >
                <p className="text-sm font-semibold text-ink">{a.school.name}</p>
                <p className="text-xs text-slate-600">{a.reason}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(a.createdAt).toLocaleString("kk-KZ")} · {ALERT_STATUS_LABEL[a.status] ?? a.status}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-lg p-4 space-y-2">
          <h2 className="font-bold text-ink">Кенет тексеруге ұсынылады</h2>
          {visibleUnannounced.length === 0 && <p className="text-sm text-slate-500">Тізім бос.</p>}
          <div className="divide-y divide-slate-100">
            {visibleUnannounced.map((s) => (
              <Link
                key={s.id}
                href={`/ses/school/${s.id}`}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    {FACILITY_KIND_LABEL[s.kind]} · {s.district.name}
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-semibold rounded-full px-2.5 py-1 ${LEVEL_BADGE[s.riskLevel]}`}>
                  {LEVEL_LABEL[s.riskLevel]} · {s.riskScore}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`anim-fade-up bg-white rounded-lg p-4 border-l-4 ${color}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}
