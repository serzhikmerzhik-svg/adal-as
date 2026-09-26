"use client";

import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import { AlertsPanel } from "@/components/ses/AlertsPanel";
import { fetcher, type OverviewAlert } from "@/components/ses/types";

export default function AlertsPage() {
  const { data, mutate } = useSWR<{ alerts: OverviewAlert[] }>("/api/ses/alerts", fetcher, { refreshInterval: 5000 });
  const alerts = data?.alerts ?? [];
  const open = alerts.filter((a) => a.status !== "CLOSED").length;

  return (
    <div className="min-h-screen pb-12">
      <AppHeader subtitle="Алерттер · Ақтау қаласы" roleLabel="Инспектор · СЭС" sesNav live />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <p className="text-sm text-muted">
          Соңғы {alerts.length} алерт · ашық: <span className="font-semibold text-ink">{open}</span>
        </p>
        {data ? <AlertsPanel alerts={alerts} onChanged={() => mutate()} /> : <div className="card h-96 animate-pulse" />}
      </main>
    </div>
  );
}
