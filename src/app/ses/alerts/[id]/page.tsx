"use client";

import { use as usePromise } from "react";
import useSWR from "swr";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { data, mutate } = useSWR(`/api/ses/alerts/${id}`, fetcher, { refreshInterval: 5000 });

  if (!data) return <div className="p-6 text-center text-slate-500">Жүктелуде...</div>;
  if (data.error) return <div className="p-6 text-center text-red-600">{data.error}</div>;

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
    <main className="min-h-screen bg-slate-50 pb-10">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Алерт</h1>
        <LogoutButton />
      </header>

      <div className="p-4 max-w-3xl mx-auto space-y-4">
        <section className={`rounded-2xl p-4 border ${alert.level === "RED" ? "bg-red-50 border-red-300" : "bg-amber-50 border-amber-300"}`}>
          <p className="text-xs uppercase font-bold text-slate-500">{alert.level === "RED" ? "Қызыл дабыл" : "Сары алерт"}</p>
          <Link href={`/ses/school/${alert.schoolId}`} className="text-lg font-bold text-slate-900 underline">
            {alert.school.name}
          </Link>
          <p className="text-sm text-slate-700 mt-1">{alert.reason}</p>
          <p className="text-xs text-slate-500 mt-1">
            {new Date(alert.createdAt).toLocaleString("kk-KZ")} · Статус: {alert.status}
          </p>

          {alert.status !== "CLOSED" && (
            <div className="flex gap-2 mt-3">
              {alert.status === "OPEN" && (
                <button onClick={() => act("acknowledge")} className="bg-slate-800 text-white rounded-lg px-4 py-2 text-sm font-semibold">
                  Қабылдадым
                </button>
              )}
              <button onClick={() => act("close")} className="bg-emerald-700 text-white rounded-lg px-4 py-2 text-sm font-semibold">
                Жабу
              </button>
            </div>
          )}
        </section>

        {symptomReports.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
            <h2 className="font-bold text-slate-900 mb-2">Белгі тіркеулері (соңғы 24 сағат)</h2>
            {symptomReports.map((r: { id: string; grade: string; symptoms: string[]; reportedAt: string }) => (
              <p key={r.id} className="text-sm text-slate-700">
                {r.grade} сынып · {r.symptoms.join(", ")} · {new Date(r.reportedAt).toLocaleTimeString("kk-KZ")}
              </p>
            ))}
          </section>
        )}

        {todaysMenu.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
            <h2 className="font-bold text-slate-900">Бүгінгі мәзір мен партиялар</h2>
            {todaysMenu.map((m: { id: string; name: string; batch: { code: string; supplier: { id: string; name: string; blocked: boolean } } | null }) => (
              <div key={m.id} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{m.name}</p>
                  {m.batch && (
                    <p className="text-xs text-slate-500">
                      Партия {m.batch.code} · {m.batch.supplier.name} {m.batch.supplier.blocked && "(бұғатталған)"}
                    </p>
                  )}
                </div>
                {m.batch && !m.batch.supplier.blocked && (
                  <button
                    onClick={() => blockSupplier(m.batch!.supplier.id)}
                    className="text-xs bg-red-600 text-white rounded-lg px-3 py-1.5 shrink-0"
                  >
                    Жеткізушіні бұғаттау
                  </button>
                )}
              </div>
            ))}
          </section>
        )}

        {trace.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
            <h2 className="font-bold text-slate-900">Партияны қадағалау — басқа мектептер</h2>
            {trace.map((t: { school: { id: string; name: string }; batchIds: string[] }) => (
              <Link
                key={t.school.id}
                href={`/ses/school/${t.school.id}`}
                className="block text-sm text-emerald-700 underline"
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
