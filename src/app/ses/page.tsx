"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import type { MapFocus } from "@/components/map/shared";
import { AlertBanner } from "@/components/ses/AlertBanner";
import { AlertsPanel } from "@/components/ses/AlertsPanel";
import { DistrictsCard } from "@/components/ses/DistrictsCard";
import { DynamicsCard } from "@/components/ses/DynamicsCard";
import { InspectionTable } from "@/components/ses/InspectionTable";
import { JournalCard } from "@/components/ses/JournalCard";
import { KpiRow } from "@/components/ses/KpiRow";
import { MapCard } from "@/components/ses/MapCard";
import { SuppliersCard } from "@/components/ses/SuppliersCard";
import { TodayInspectionsCard } from "@/components/ses/TodayInspectionsCard";
import { fetcher, type Overview, type Stats, type SupplierRow, type Unannounced } from "@/components/ses/types";
import { shortName } from "@/lib/format";

export default function SesDashboard() {
  const overview = useSWR<Overview>("/api/ses/overview", fetcher, { refreshInterval: 5000 });
  const stats = useSWR<Stats>("/api/ses/stats", fetcher, { refreshInterval: 30000 });
  const suppliers = useSWR<{ suppliers: SupplierRow[] }>("/api/ses/suppliers", fetcher, { refreshInterval: 30000 });
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const knownAlertIds = useRef<Set<string> | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const refreshAll = () => {
    overview.mutate();
    stats.mutate();
    suppliers.mutate();
  };

  // Жаңа қызыл алерт келгенде toast шығады (алғашқы жүктеуде емес).
  const alerts = overview.data?.alerts;
  useEffect(() => {
    if (!alerts) return;
    if (knownAlertIds.current === null) {
      knownAlertIds.current = new Set(alerts.map((a) => a.id));
      return;
    }
    const fresh = alerts.find((a) => a.level === "RED" && !knownAlertIds.current!.has(a.id));
    knownAlertIds.current = new Set(alerts.map((a) => a.id));
    if (!fresh) return;
    const show = setTimeout(() => setToast(`Жаңа қызыл дабыл: ${shortName(fresh.school.name, fresh.school.kind)}`), 0);
    const hide = setTimeout(() => setToast(null), 6000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [alerts]);

  function showOnMap(row: Unannounced) {
    setFocus({ key: Date.now(), kind: "points", points: [{ lat: row.lat, lng: row.lng }] });
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const data = overview.data;

  return (
    <div className="min-h-screen pb-12">
      <AppHeader subtitle="СЭС дашборды · Маңғыстау облысы" roleLabel="Инспектор · ДСЭК" sesNav live />

      {toast && (
        <div className="anim-slide-in fixed top-20 right-4 z-[60] rounded-lg bg-bad-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <main className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6 space-y-5">
        {overview.error && !data && (
          <p className="card p-5 text-sm text-bad-600">Деректерді жүктеу мүмкін болмады. Бет 5 секундтан кейін қайта көреді.</p>
        )}
        {!data ? (
          <div className="grid gap-5">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="card h-[118px] animate-pulse" />
              ))}
            </div>
            <div className="card h-[540px] animate-pulse" />
          </div>
        ) : (
          <>
            {data.banner && <AlertBanner alert={data.banner} />}
            <KpiRow kpi={data.kpi} />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
              <div ref={mapRef}>
                <MapCard schools={data.schools} unannounced={data.unannounced} basePath="/ses/school" focus={focus} onFocus={setFocus} />
              </div>
              {/* Алерттер панелі карта биіктігінен аспайды: ішкі тізім айналады. */}
              <div className="relative min-h-[420px]">
                <AlertsPanel alerts={data.alerts} onChanged={refreshAll} className="lg:absolute lg:inset-0 max-h-[560px] lg:max-h-none" />
              </div>
            </div>

            <InspectionTable rows={data.unannounced} onChanged={refreshAll} onShowOnMap={showOnMap} />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {stats.data ? <JournalCard journal={stats.data.journal} /> : <div className="card h-[260px] animate-pulse" />}
              {stats.data ? <DynamicsCard dynamics={stats.data.dynamics} /> : <div className="card h-[260px] animate-pulse" />}
              <DistrictsCard schools={data.schools} />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
              {suppliers.data ? (
                <SuppliersCard suppliers={suppliers.data.suppliers} onChanged={refreshAll} limit={5} />
              ) : (
                <div className="card h-[300px] animate-pulse" />
              )}
              {stats.data ? (
                <TodayInspectionsCard
                  inspections={stats.data.inspections}
                  prescriptions={stats.data.prescriptions}
                  schools={data.schools}
                  onChanged={refreshAll}
                />
              ) : (
                <div className="card h-[300px] animate-pulse" />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
