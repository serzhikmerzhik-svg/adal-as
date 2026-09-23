"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import useSWR from "swr";
import QRCode from "qrcode";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { LogoutButton } from "@/components/LogoutButton";
import { RISK_COMPONENT_LABELS, LEVEL_LABEL, LEVEL_BADGE } from "@/lib/risk/labels";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { data, mutate } = useSWR(`/api/ses/schools/${id}`, fetcher, { refreshInterval: 10000 });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [inspectionForm, setInspectionForm] = useState({ type: "MONITORING", plannedAt: "" });
  const [prescriptionForm, setPrescriptionForm] = useState({ text: "", dueAt: "" });
  const qrGenerated = useRef(false);

  useEffect(() => {
    if (data?.school?.parentToken && !qrGenerated.current) {
      qrGenerated.current = true;
      const url = `${window.location.origin}/p/${data.school.parentToken}`;
      QRCode.toDataURL(url, { width: 180 }).then(setQrDataUrl);
    }
  }, [data]);

  if (!data) return <div className="p-6 text-center text-slate-500">Жүктелуде...</div>;
  if (data.error) return <div className="p-6 text-center text-red-600">{data.error}</div>;

  const { school, latestComponents, riskHistory, kitchenLogs, symptomReports, feedback, inspections, prescriptions } = data;

  const chartData = riskHistory.map((r: { computedAt: string; score: number }) => ({
    date: new Date(r.computedAt).toLocaleDateString("kk-KZ", { day: "2-digit", month: "2-digit" }),
    score: r.score,
  }));

  async function submitInspection(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/ses/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: id, ...inspectionForm, plannedAt: new Date(inspectionForm.plannedAt).toISOString() }),
    });
    setInspectionForm({ type: "MONITORING", plannedAt: "" });
    mutate();
  }

  async function submitPrescription(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/ses/prescriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: id, text: prescriptionForm.text, dueAt: new Date(prescriptionForm.dueAt).toISOString() }),
    });
    setPrescriptionForm({ text: "", dueAt: "" });
    mutate();
  }

  async function decidePrescription(prescriptionId: string, action: "accept" | "reject") {
    await fetch(`/api/prescriptions/${prescriptionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    mutate();
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">{school.name}</h1>
        <LogoutButton />
      </header>

      <div className="p-4 max-w-5xl mx-auto space-y-4">
        <section className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-4 justify-between">
          <div>
            <p className="text-sm text-slate-500">{school.district.name} · {school.address}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {school.riskScore} <span className={`text-sm rounded-full px-2 py-1 ${LEVEL_BADGE[school.riskLevel]}`}>{LEVEL_LABEL[school.riskLevel]}</span>
            </p>
          </div>
          {qrDataUrl && (
            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Ата-ана QR" className="w-24 h-24" />
              <p className="text-xs text-slate-500 mt-1">Ата-ана беті</p>
            </div>
          )}
        </section>

        {latestComponents && (
          <section className="bg-white rounded-2xl border border-slate-200 p-4">
            <h2 className="font-bold text-slate-900 mb-3">Тәуекел балының құрамы</h2>
            <div className="space-y-2">
              {Object.entries(RISK_COMPONENT_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{label}</span>
                  <span className="font-semibold text-slate-900">{(latestComponents as Record<string, number>)[key] ?? 0}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="font-bold text-slate-900 mb-3">Соңғы 30 күндегі тәуекел</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#0f766e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <form onSubmit={submitInspection} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <h2 className="font-bold text-slate-900">Тексеру тағайындау</h2>
            <select
              value={inspectionForm.type}
              onChange={(e) => setInspectionForm((s) => ({ ...s, type: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            >
              <option value="MONITORING">Мониторинг</option>
              <option value="UNANNOUNCED">Кенет</option>
              <option value="UNSCHEDULED">Жоспардан тыс</option>
            </select>
            <input
              type="datetime-local"
              required
              value={inspectionForm.plannedAt}
              onChange={(e) => setInspectionForm((s) => ({ ...s, plannedAt: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
            <button className="w-full bg-slate-800 text-white rounded-lg py-2 font-semibold">Тағайындау</button>
          </form>

          <form onSubmit={submitPrescription} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <h2 className="font-bold text-slate-900">Нұсқама беру</h2>
            <textarea
              required
              value={prescriptionForm.text}
              onChange={(e) => setPrescriptionForm((s) => ({ ...s, text: e.target.value }))}
              placeholder="Нұсқама мәтіні"
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              rows={2}
            />
            <input
              type="date"
              required
              value={prescriptionForm.dueAt}
              onChange={(e) => setPrescriptionForm((s) => ({ ...s, dueAt: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
            <button className="w-full bg-amber-600 text-white rounded-lg py-2 font-semibold">Беру</button>
          </form>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <h2 className="font-bold text-slate-900">Нұсқамалар тарихы</h2>
          {prescriptions.length === 0 && <p className="text-sm text-slate-500">Жоқ.</p>}
          {prescriptions.map((p: { id: string; text: string; status: string; dueAt: string; evidencePhotoUrl: string | null }) => (
            <div key={p.id} className="border-b border-slate-100 last:border-0 py-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-800">{p.text}</p>
                <p className="text-xs text-slate-500">Мерзімі: {new Date(p.dueAt).toLocaleDateString("kk-KZ")} · {p.status}</p>
              </div>
              {p.status === "SUBMITTED" && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => decidePrescription(p.id, "accept")} className="text-xs bg-emerald-600 text-white rounded-lg px-3 py-1.5">Қабылдау</button>
                  <button onClick={() => decidePrescription(p.id, "reject")} className="text-xs bg-red-600 text-white rounded-lg px-3 py-1.5">Қайтару</button>
                </div>
              )}
            </div>
          ))}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <h2 className="font-bold text-slate-900">Асхана журналы</h2>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {kitchenLogs.map((l: { id: string; type: string; valueC: number | null; isViolation: boolean; createdAt: string; menuItem: { name: string } | null }) => (
              <div key={l.id} className="text-xs flex justify-between border-b border-slate-100 py-1.5">
                <span>{l.menuItem?.name ?? "—"} · {l.type === "PHOTO" ? "фото" : `${l.valueC}°C`}</span>
                <span className={l.isViolation ? "text-red-600 font-semibold" : "text-slate-400"}>
                  {new Date(l.createdAt).toLocaleString("kk-KZ")}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
            <h2 className="font-bold text-slate-900 mb-2">Белгілер тіркеулері</h2>
            {symptomReports.map((r: { id: string; grade: string; symptoms: string[]; reportedAt: string }) => (
              <p key={r.id} className="text-xs text-slate-600">{r.grade} · {r.symptoms.join(", ")} · {new Date(r.reportedAt).toLocaleString("kk-KZ")}</p>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
            <h2 className="font-bold text-slate-900 mb-2">Ата-ана бағалары</h2>
            {feedback.map((f: { id: string; rating: number; comment: string | null; createdAt: string }) => (
              <p key={f.id} className="text-xs text-slate-600">{"★".repeat(f.rating)} {f.comment ?? ""}</p>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
          <h2 className="font-bold text-slate-900 mb-2">Тексерулер тарихы</h2>
          {inspections.map((i: { id: string; type: string; plannedAt: string; result: string | null }) => (
            <p key={i.id} className="text-xs text-slate-600">{i.type} · {new Date(i.plannedAt).toLocaleDateString("kk-KZ")} · {i.result ?? "нәтиже жоқ"}</p>
          ))}
        </section>
      </div>
    </main>
  );
}
