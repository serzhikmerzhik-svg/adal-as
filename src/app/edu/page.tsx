"use client";

import { useState } from "react";
import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import type { MapFocus } from "@/components/map/shared";
import { AlertsPanel } from "@/components/ses/AlertsPanel";
import { DistrictsCard } from "@/components/ses/DistrictsCard";
import { DynamicsCard } from "@/components/ses/DynamicsCard";
import { InspectionTable } from "@/components/ses/InspectionTable";
import { KpiRow } from "@/components/ses/KpiRow";
import { MapCard } from "@/components/ses/MapCard";
import { fetcher, type Kind, type Overview, type Stats } from "@/components/ses/types";

// Білім басқармасы тек білім беру ұйымдарын көреді (қоғамдық асханалар — СЭС құзыреті)
// және ешқандай әрекет жасамайды: тексеру мен нұсқама — СЭС инспекторының шешімі.
const isEducation = (kind: Kind) => kind !== "CANTEEN";

export default function EduPage() {
  const overview = useSWR<Overview>("/api/ses/overview", fetcher, { refreshInterval: 5000 });
  const stats = useSWR<Stats>("/api/ses/stats", fetcher, { refreshInterval: 30000 });
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const data = overview.data;

  const schools = data ? data.schools.filter((s) => isEducation(s.kind)) : [];
  const alerts = data ? data.alerts.filter((a) => isEducation(a.school.kind)) : [];
  const unannounced = data ? data.unannounced.filter((s) => isEducation(s.kind)) : [];
  const open = alerts.filter((a) => a.status !== "CLOSED");
  const kpi = {
    total: schools.length,
    green: schools.filter((s) => s.riskLevel === "GREEN").length,
    yellow: schools.filter((s) => s.riskLevel === "YELLOW").length,
    red: schools.filter((s) => s.riskLevel === "RED").length,
    openAlerts: open.length,
    openRed: open.filter((a) => a.level === "RED").length,
    openYellow: open.filter((a) => a.level === "YELLOW").length,
    overduePrescriptions: data?.kpi.overduePrescriptions ?? 0,
  };

  return (
    <div className="min-h-screen pb-12">
      <AppHeader subtitle="Білім беру ұйымдары · Маңғыстау облысы" roleLabel="Білім басқармасы" live />
      <main className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6 space-y-5">
        {!data ? (
          <div className="card h-[540px] animate-pulse" />
        ) : (
          <>
            <p className="text-sm text-muted">Тек оқу режимі: мектептер мен балабақшалар. Тексеру мен нұсқаманы СЭС инспекторы тағайындайды.</p>
            <KpiRow kpi={kpi} />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
              <MapCard schools={schools} unannounced={unannounced} focus={focus} onFocus={setFocus} />
              <div className="relative min-h-[420px]">
                <AlertsPanel alerts={alerts} readOnly className="lg:absolute lg:inset-0 max-h-[560px] lg:max-h-none" />
              </div>
            </div>
            <InspectionTable rows={unannounced} readOnly />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <DistrictsCard schools={schools} />
              {stats.data ? <DynamicsCard dynamics={stats.data.dynamics} /> : <div className="card h-[260px] animate-pulse" />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
