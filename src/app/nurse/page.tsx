"use client";

import { useEffect, useState, useCallback } from "react";
import { AppHeader } from "@/components/AppHeader";

const SYMPTOM_LABELS: Record<string, string> = {
  NAUSEA: "Жүрек айну",
  VOMITING: "Құсу",
  DIARRHEA: "Диарея",
  FEVER: "Дене қызуы",
  ABDOMINAL_PAIN: "Іш ауыру",
  OTHER: "Басқа",
};

type Report = {
  id: string;
  grade: string;
  symptoms: string[];
  reportedAt: string;
};

export default function NursePage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [grade, setGrade] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/nurse/reports");
    const data = await res.json();
    setReports(data.reports ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSymptom(s: string) {
    setSymptoms((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!grade || symptoms.length === 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/nurse/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, symptoms }),
      });
      const data = await res.json();
      setMessage(data.alertCreated ? "Тіркелді. Қызыл дабыл іске қосылды!" : "Тіркелді.");
      setGrade("");
      setSymptoms([]);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen pb-24">
      <AppHeader subtitle="Медбике" />

      <div className="p-4 space-y-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 space-y-4 border border-slate-200">
          <h2 className="font-bold text-ink">Белгі тіркеу</h2>

          <div>
            <label className="text-sm font-medium text-slate-700">Сынып</label>
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="мыс. 7А"
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Белгілер</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(SYMPTOM_LABELS).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => toggleSymptom(key)}
                  className={`rounded-xl py-3 text-sm font-medium border ${
                    symptoms.includes(key)
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white text-slate-700 border-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {message && <p className="text-sm font-medium text-brand-700">{message}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-red-600 text-white font-bold rounded-xl py-3.5 text-base disabled:opacity-60"
          >
            {submitting ? "Тіркелуде..." : "Тіркеу"}
          </button>
        </form>

        <section className="space-y-2">
          <h2 className="font-bold text-ink">Соңғы 24 сағат</h2>
          {reports.length === 0 && <p className="text-sm text-slate-500">Тіркеулер жоқ.</p>}
          {reports.map((r) => (
            <div key={r.id} className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="font-medium text-ink">{r.grade} сынып</p>
                <p className="text-xs text-slate-500">{r.symptoms.map((s) => SYMPTOM_LABELS[s] ?? s).join(", ")}</p>
              </div>
              <p className="text-xs text-slate-400">
                {new Date(r.reportedAt).toLocaleTimeString("kk-KZ", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
