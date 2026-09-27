"use client";

import { use as usePromise } from "react";
import useSWR from "swr";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { alertText } from "@/lib/alertText";
import { dateTime, hm, shortName } from "@/lib/format";
import { useLocale, useT } from "@/i18n/client";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type MenuRow = { id: string; name: string; batch: { code: string; supplier: { id: string; name: string; blocked: boolean } } | null };

export default function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const t = useT();
  const locale = useLocale();
  const a = t.alertDetail;
  const { data, mutate } = useSWR(`/api/ses/alerts/${id}`, fetcher, { refreshInterval: 5000 });

  if (!data) return <div className="p-6 text-center text-muted">{t.common.loading}</div>;
  if (data.error) return <div className="p-6 text-center text-bad-700">{data.error}</div>;

  const { alert, symptomReports, todaysMenu, trace } = data;

  async function act(action: "acknowledge" | "close") {
    const closingNote = action === "close" ? (window.prompt(a.closePrompt) ?? "") : undefined;
    await fetch(`/api/ses/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, closingNote }),
    });
    mutate();
  }

  async function blockSupplier(supplierId: string) {
    if (!window.confirm(a.confirmBlock)) return;
    await fetch(`/api/ses/suppliers/${supplierId}/block`, { method: "PATCH" });
    mutate();
  }

  const red = alert.level === "RED";
  return (
    <main className="min-h-screen pb-10">
      <AppHeader subtitle={a.subtitle} backHref="/ses/alerts" roleLabel={t.roles.ses} sesNav />

      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <section className={`rounded-lg border p-4 ${red ? "border-bad-300 bg-bad-50" : "border-warn-500 bg-warn-50"}`}>
          <p className="text-xs font-bold uppercase text-muted">
            {red ? a.red : a.yellow}
            {alert.rule && t.rules.names[alert.rule] ? ` · ${t.rules.names[alert.rule]}` : ""}
          </p>
          <Link href={`/ses/school/${alert.schoolId}`} className="text-lg font-bold text-ink underline" title={alert.school.name}>
            {shortName(alert.school.name, alert.school.kind ?? "SCHOOL", locale)}
          </Link>
          <p className="mt-1 text-sm text-ink">{alertText(alert, t, locale)}</p>
          <p className="mt-1 text-xs text-muted">
            {dateTime(alert.createdAt)} · {a.status}: {t.alertStatus[alert.status] ?? alert.status}
          </p>

          {alert.status !== "CLOSED" && (
            <div className="mt-3 flex gap-2">
              {alert.status === "OPEN" && (
                <button type="button" onClick={() => act("acknowledge")} className="btn btn-outline">
                  {a.acknowledge}
                </button>
              )}
              <button type="button" onClick={() => act("close")} className="btn btn-primary">
                {a.close}
              </button>
            </div>
          )}
        </section>

        {symptomReports.length > 0 && (
          <section className="card space-y-1 p-4">
            <h2 className="mb-2 font-bold text-ink">{a.symptomsTitle}</h2>
            {symptomReports.map((r: { id: string; grade: string; symptoms: string[]; otherNote: string | null; reportedAt: string }) => (
              <p key={r.id} className="text-sm text-ink">
                {a.grade(r.grade)} · {r.symptoms.map((s) => t.symptoms[s] ?? s).join(", ")}
                {r.otherNote ? ` (${r.otherNote})` : ""} · {hm(r.reportedAt)}
              </p>
            ))}
          </section>
        )}

        {todaysMenu.length > 0 && (
          <section className="card space-y-2 p-4">
            <h2 className="font-bold text-ink">{a.menuTitle}</h2>
            {todaysMenu.map((m: MenuRow) => (
              <div key={m.id} className="flex items-center justify-between border-b border-line py-2 last:border-0">
                <div>
                  <p className="text-sm font-medium text-ink">{m.name}</p>
                  {m.batch && (
                    <p className="text-xs text-muted">
                      {a.batch(m.batch.code, m.batch.supplier.name)} {m.batch.supplier.blocked && a.blockedMark}
                    </p>
                  )}
                </div>
                {m.batch && !m.batch.supplier.blocked && (
                  <button type="button" onClick={() => blockSupplier(m.batch!.supplier.id)} className="btn btn-danger btn-sm shrink-0">
                    {a.blockSupplier}
                  </button>
                )}
              </div>
            ))}
          </section>
        )}

        {trace.length > 0 && (
          <section className="card space-y-2 p-4">
            <h2 className="font-bold text-ink">{a.traceTitle}</h2>
            {trace.map((row: { school: { id: string; name: string; kind?: string }; batchIds: string[] }) => (
              <Link key={row.school.id} href={`/ses/school/${row.school.id}`} className="block text-sm text-primary underline">
                {shortName(row.school.name, row.school.kind ?? "SCHOOL", locale)} ({a.traceBatches(row.batchIds.length)})
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
