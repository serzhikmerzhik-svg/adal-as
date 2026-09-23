"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

export default function DemoPage() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(step: "step1" | "step2" | "reset", label: string) {
    setBusy(step);
    try {
      const res = await fetch(`/api/demo/${step}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setLog((l) => [`❌ ${label}: ${data.error}`, ...l]);
        return;
      }
      setLog((l) => [`✅ ${label}: ${JSON.stringify(data)}`, ...l]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Демо басқару</h1>
        <LogoutButton />
      </header>

      <div className="p-4 max-w-xl mx-auto space-y-4">
        <p className="text-sm text-slate-600">
          Бұл бет питч кезінде демо сценарийін ретімен іске қосу үшін арналған. Нақты API арқылы
          жұмыс істейді — ешбір деректер тікелей ДБ-ға жазылмайды.
        </p>

        <button
          onClick={() => run("step1", "1-қадам: асхана журналы")}
          disabled={busy !== null}
          className="w-full bg-emerald-600 text-white font-semibold rounded-xl py-3.5 disabled:opacity-60"
        >
          1-қадам: Асхана журналын толтыру
        </button>

        <button
          onClick={() => run("step2", "2-қадам: 4 оқушыда белгілер")}
          disabled={busy !== null}
          className="w-full bg-red-600 text-white font-semibold rounded-xl py-3.5 disabled:opacity-60"
        >
          2-қадам: 4 оқушыда белгілер тіркеу (қызыл дабыл)
        </button>

        <button
          onClick={() => run("reset", "Демоны қалпына келтіру")}
          disabled={busy !== null}
          className="w-full bg-slate-700 text-white font-semibold rounded-xl py-3.5 disabled:opacity-60"
        >
          Демоны қалпына келтіру
        </button>

        <Link href="/ses" className="block text-center text-emerald-700 underline text-sm">
          СЭС дашбордын ашу →
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1 text-xs font-mono max-h-64 overflow-y-auto">
          {log.length === 0 && <p className="text-slate-400">Журнал бос.</p>}
          {log.map((l, i) => (
            <p key={i} className="text-slate-700 break-all">{l}</p>
          ))}
        </div>
      </div>
    </main>
  );
}
