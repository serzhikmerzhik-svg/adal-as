"use client";

import dynamic from "next/dynamic";
import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import { LEVEL_LABEL, LEVEL_BADGE, ALERT_STATUS_LABEL } from "@/lib/risk/labels";

const SchoolMap = dynamic(() => import("@/components/SchoolMap").then((m) => m.SchoolMap), { ssr: false });

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type School = {
  id: string;
  name: string;
  kind: "SCHOOL" | "KINDERGARTEN" | "CANTEEN";
  lat: number;
  lng: number;
  riskScore: number;
  riskLevel: "GREEN" | "YELLOW" | "RED";
  district: { id: string; name: string };
};

type Alert = {
  id: string;
  level: "YELLOW" | "RED";
  reason: string;
  status: string;
  createdAt: string;
  school: { name: string; kind: School["kind"] };
};

// Білім басқармасы тек білім беру ұйымдарын көреді (қоғамдық асханалар — СЭС құзыреті).
const isEducation = (kind: School["kind"]) => kind !== "CANTEEN";

export default function EduPage() {
  const { data } = useSWR("/api/ses/overview", fetcher, { refreshInterval: 5000 });

  if (!data) return <div className="p-6 text-center text-slate-500">Жүктелуде...</div>;

  const schools = (data.schools as School[]).filter((s) => isEducation(s.kind));
  const alerts = (data.alerts as Alert[]).filter((a) => isEducation(a.school.kind));
  const kpi = {
    green: schools.filter((s) => s.riskLevel === "GREEN").length,
    yellow: schools.filter((s) => s.riskLevel === "YELLOW").length,
    red: schools.filter((s) => s.riskLevel === "RED").length,
    openAlerts: alerts.filter((a) => a.status !== "CLOSED").length,
    overduePrescriptions: data.kpi.overduePrescriptions as number,
  };

  const byDistrict = new Map<string, { name: string; green: number; yellow: number; red: number }>();
  for (const s of schools) {
    const entry = byDistrict.get(s.district.id) ?? { name: s.district.name, green: 0, yellow: 0, red: 0 };
    if (s.riskLevel === "GREEN") entry.green += 1;
    else if (s.riskLevel === "YELLOW") entry.yellow += 1;
    else entry.red += 1;
    byDistrict.set(s.district.id, entry);
  }

  return (
    <main className="min-h-screen pb-10">
      <AppHeader subtitle="Білім басқармасы — шолу" />

      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Жасыл" value={kpi.green} color="border-brand-600 text-brand-700" />
          <KpiCard label="Сары" value={kpi.yellow} color="border-amber-500 text-amber-700" />
          <KpiCard label="Қызыл" value={kpi.red} color="border-red-600 text-red-700" />
          <KpiCard label="Ашық алерттер" value={kpi.openAlerts} color="border-sky-accent text-sky-accent-dark" />
          <KpiCard label="Мерзімі өткен нұсқама" value={kpi.overduePrescriptions} color="border-orange-500 text-orange-700" />
        </section>

        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-lg p-3 h-[420px]">
            <SchoolMap schools={schools} />
          </div>

          <div className="bg-white rounded-lg p-4 space-y-3 max-h-[420px] overflow-y-auto">
            <h2 className="font-bold text-ink">Алерттер лентасы</h2>
            {alerts.length === 0 && <p className="text-sm text-slate-500">Алерттер жоқ.</p>}
            {alerts.map((a: Alert) => (
              <div
                key={a.id}
                className={`anim-slide-in rounded-md p-3 border-l-4 ${a.level === "RED" ? "border-red-600 bg-red-50" : "border-amber-500 bg-amber-50"}`}
              >
                <p className="text-sm font-semibold text-ink">{a.school.name}</p>
                <p className="text-xs text-slate-600">{a.reason}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(a.createdAt).toLocaleString("kk-KZ")} · {ALERT_STATUS_LABEL[a.status] ?? a.status}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-lg p-4">
          <h2 className="font-bold text-ink mb-3">Аудандар бойынша статистика</h2>
          <div className="divide-y divide-slate-100">
            {Array.from(byDistrict.values()).map((d) => (
              <div key={d.name} className="flex items-center justify-between py-2">
                <span className="font-medium text-slate-800">{d.name}</span>
                <div className="flex gap-2">
                  <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${LEVEL_BADGE.GREEN}`}>{LEVEL_LABEL.GREEN}: {d.green}</span>
                  <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${LEVEL_BADGE.YELLOW}`}>{LEVEL_LABEL.YELLOW}: {d.yellow}</span>
                  <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${LEVEL_BADGE.RED}`}>{LEVEL_LABEL.RED}: {d.red}</span>
                </div>
              </div>
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
