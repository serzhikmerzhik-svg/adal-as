"use client";

import { use as usePromise } from "react";
import useSWR from "swr";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ALERT_STATUS_LABEL, symptomsText } from "@/lib/risk/labels";
import { dateTime, hm } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { data, mutate } = useSWR(`/api/ses/alerts/${id}`, fetcher, { refreshInterval: 5000 });

  if (!data) return <div className="p-6 text-center text-muted">Жүктелуде...</div>;
  if (data.error) return <div className="p-6 text-center text-bad-600">{data.error}</div>;

  const { alert, symptomReports, todaysMenu, trace } = data;

  async function act(action: "acknowledge" | "close") {
    const closingNote = action === "close" ? window.prompt("Жабу себебі / қорытынды:") ?? "" : undefined;
    await fetch(`/api/ses/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, closingNote }),
    });
    mutate();
  }

  async function blockSupplier(supplierId: string) {
    if (!window.confirm("Жеткізушіні бұғаттауды растайсыз ба?")) return;
    await fetch(`/api/ses/suppliers/${supplierId}/block`, { method: "PATCH" });
    mutate();
  }

  return (
    <main className="min-h-screen pb-10">
      <AppHeader subtitle="Алерт" backHref="/ses/alerts" roleLabel="Инспектор · ДСЭК" sesNav />

      <div className="p-4 max-w-3xl mx-auto space-y-4">
        <section className={`rounded-lg p-4 border ${alert.level === "RED" ? "bg-bad-50 border-bad-300" : "bg-warn-50 border-warn-500"}`}>
          <p className="text-xs uppercase font-bold text-muted">{alert.level === "RED" ? "Қызыл дабыл" : "Сары алерт"}</p>
          <Link href={`/ses/school/${alert.schoolId}`} className="text-lg font-bold text-ink underline">
            {alert.school.name}
          </Link>
          <p className="text-sm text-ink mt-1">{alert.reason}</p>
          <p className="text-xs text-muted mt-1">
            {dateTime(alert.createdAt)} · Статус: {ALERT_STATUS_LABEL[alert.status] ?? alert.status}
          </p>

          {alert.status !== "CLOSED" && (
            <div className="flex gap-2 mt-3">
              {alert.status === "OPEN" && (
                <button onClick={() => act("acknowledge")} className="btn btn-outline">
                  Қабылдадым
                </button>
              )}
              <button onClick={() => act("close")} className="btn btn-primary">
                Жабу
              </button>
            </div>
          )}
        </section>

        {symptomReports.length > 0 && (
          <section className="card p-4 space-y-1">
            <h2 className="font-bold text-ink mb-2">Белгі тіркеулері (соңғы 24 сағат)</h2>
            {symptomReports.map((r: { id: string; grade: string; symptoms: string[]; reportedAt: string }) => (
              <p key={r.id} className="text-sm text-ink">
                {r.grade} сынып · {symptomsText(r.symptoms)} · {hm(r.reportedAt)}
              </p>
            ))}
          </section>
        )}

        {todaysMenu.length > 0 && (
          <section className="card p-4 space-y-2">
            <h2 className="font-bold text-ink">Бүгінгі мәзір мен партиялар</h2>
            {todaysMenu.map((m: { id: string; name: string; batch: { code: string; supplier: { id: string; name: string; blocked: boolean } } | null }) => (
              <div key={m.id} className="flex items-center justify-between border-b border-line py-2 last:border-0">
                <div>
                  <p className="text-sm font-medium text-ink">{m.name}</p>
                  {m.batch && (
                    <p className="text-xs text-muted">
                      Партия {m.batch.code} · {m.batch.supplier.name} {m.batch.supplier.blocked && "(бұғатталған)"}
                    </p>
                  )}
                </div>
                {m.batch && !m.batch.supplier.blocked && (
                  <button
                    onClick={() => blockSupplier(m.batch!.supplier.id)}
                    className="btn btn-danger btn-sm shrink-0"
                  >
                    Жеткізушіні бұғаттау
                  </button>
                )}
              </div>
            ))}
          </section>
        )}

        {trace.length > 0 && (
          <section className="card p-4 space-y-2">
            <h2 className="font-bold text-ink">Партияны қадағалау — басқа мектептер</h2>
            {trace.map((t: { school: { id: string; name: string }; batchIds: string[] }) => (
              <Link
                key={t.school.id}
                href={`/ses/school/${t.school.id}`}
                className="block text-sm text-navy-700 underline"
              >
                {t.school.name} ({t.batchIds.length} партия)
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
