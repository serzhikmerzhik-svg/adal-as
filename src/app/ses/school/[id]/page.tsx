"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import useSWR from "swr";
import QRCode from "qrcode";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AppHeader } from "@/components/AppHeader";
import { dateTime, ddmm, fullDate } from "@/lib/format";
import {
  RISK_COMPONENT_LABELS,
  LEVEL_LABEL,
  LEVEL_BADGE,
  PRESCRIPTION_STATUS_LABEL,
  INSPECTION_TYPE_LABEL,
  symptomsText,
  FACILITY_KIND_LABEL,
} from "@/lib/risk/labels";

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

  if (!data) return <div className="p-6 text-center text-muted">Жүктелуде...</div>;
  if (data.error) return <div className="p-6 text-center text-bad-600">{data.error}</div>;

  const { school, latestComponents, riskHistory, kitchenLogs, symptomReports, feedback, inspections, prescriptions } = data;

  const chartData = riskHistory.map((r: { computedAt: string; score: number }) => ({
    date: ddmm(r.computedAt),
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
    <main className="min-h-screen pb-10">
      <AppHeader subtitle={school.name} backHref="/ses" roleLabel="Инспектор · ДСЭК" sesNav />

      <div className="p-4 max-w-5xl mx-auto space-y-4">
        <section className="card p-4 flex flex-wrap items-center gap-4 justify-between">
          <div>
            <p className="text-sm text-muted">
              {FACILITY_KIND_LABEL[school.kind]}
              {school.rubric && ` (${school.rubric}, 2GIS)`} · {school.district.name} · {school.address}
            </p>
            <p className="text-3xl font-bold text-ink mt-1">
              {school.riskScore} <span className={`text-sm rounded-full px-2 py-1 ${LEVEL_BADGE[school.riskLevel]}`}>{LEVEL_LABEL[school.riskLevel]}</span>
            </p>
          </div>
          {qrDataUrl && (
            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Ата-ана QR" className="w-24 h-24" />
              <p className="text-xs text-muted mt-1">Ата-ана беті</p>
            </div>
          )}
        </section>

        {latestComponents && (
          <section className="card p-4">
            <h2 className="font-bold text-ink mb-3">Тәуекел балының құрамы</h2>
            <div className="space-y-2">
              {Object.entries(RISK_COMPONENT_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{label}</span>
                  <span className="font-semibold text-ink">{(latestComponents as Record<string, number>)[key] ?? 0}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card p-4">
          <h2 className="font-bold text-ink mb-3">Соңғы 30 күндегі тәуекел</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ece8e0" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#1f3b63" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <form onSubmit={submitInspection} className="card p-4 space-y-3">
            <h2 className="font-bold text-ink">Тексеру тағайындау</h2>
            <select
              value={inspectionForm.type}
              onChange={(e) => setInspectionForm((s) => ({ ...s, type: e.target.value }))}
              className="field"
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
              className="field"
            />
            <button className="btn btn-primary w-full">Тағайындау</button>
          </form>

          <form onSubmit={submitPrescription} className="card p-4 space-y-3">
            <h2 className="font-bold text-ink">Нұсқама беру</h2>
            <textarea
              required
              value={prescriptionForm.text}
              onChange={(e) => setPrescriptionForm((s) => ({ ...s, text: e.target.value }))}
              placeholder="Нұсқама мәтіні"
              className="field"
              rows={2}
            />
            <input
              type="date"
              required
              value={prescriptionForm.dueAt}
              onChange={(e) => setPrescriptionForm((s) => ({ ...s, dueAt: e.target.value }))}
              className="field"
            />
            <button className="btn btn-primary w-full">Беру</button>
          </form>
        </section>

        <section className="card p-4 space-y-2">
          <h2 className="font-bold text-ink">Нұсқамалар тарихы</h2>
          {prescriptions.length === 0 && <p className="text-sm text-muted">Жоқ.</p>}
          {prescriptions.map((p: { id: string; text: string; status: string; dueAt: string; evidencePhotoUrl: string | null }) => (
            <div key={p.id} className="border-b border-line last:border-0 py-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink">{p.text}</p>
                <p className="text-xs text-muted">Мерзімі: {fullDate(p.dueAt)} · {PRESCRIPTION_STATUS_LABEL[p.status] ?? p.status}</p>
              </div>
              {p.status === "SUBMITTED" && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => decidePrescription(p.id, "accept")} className="btn btn-primary btn-sm">Қабылдау</button>
                  <button onClick={() => decidePrescription(p.id, "reject")} className="btn btn-danger btn-sm">Қайтару</button>
                </div>
              )}
            </div>
          ))}
        </section>

        <section className="card p-4 space-y-2">
          <h2 className="font-bold text-ink">Асхана журналы</h2>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {kitchenLogs.map((l: { id: string; type: string; valueC: number | null; isViolation: boolean; createdAt: string; menuItem: { name: string } | null }) => (
              <div key={l.id} className="text-xs flex justify-between border-b border-line py-1.5">
                <span>{l.menuItem?.name ?? "—"} · {l.type === "PHOTO" ? "фото" : `${l.valueC}°C`}</span>
                <span className={l.isViolation ? "text-bad-600 font-semibold" : "text-muted"}>
                  {dateTime(l.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="card p-4 space-y-1">
            <h2 className="font-bold text-ink mb-2">Белгілер тіркеулері</h2>
            {symptomReports.map((r: { id: string; grade: string; symptoms: string[]; reportedAt: string }) => (
              <p key={r.id} className="text-xs text-muted">{r.grade} · {symptomsText(r.symptoms)} · {dateTime(r.reportedAt)}</p>
            ))}
          </div>
          <div className="card p-4 space-y-1">
            <h2 className="font-bold text-ink mb-2">Ата-ана бағалары</h2>
            {feedback.map((f: { id: string; rating: number; comment: string | null; createdAt: string }) => (
              <p key={f.id} className="text-xs text-muted">{"★".repeat(f.rating)} {f.comment ?? ""}</p>
            ))}
          </div>
        </section>

        <section className="card p-4 space-y-1">
          <h2 className="font-bold text-ink mb-2">Тексерулер тарихы</h2>
          {inspections.map((i: { id: string; type: string; plannedAt: string; result: string | null }) => (
            <p key={i.id} className="text-xs text-muted">{INSPECTION_TYPE_LABEL[i.type] ?? i.type} · {fullDate(i.plannedAt)} · {i.result ?? "нәтиже жоқ"}</p>
          ))}
        </section>
      </div>
    </main>
  );
}
