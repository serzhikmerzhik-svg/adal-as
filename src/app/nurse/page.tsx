"use client";

import { useState } from "react";
import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import { hm } from "@/lib/format";
import { useT } from "@/i18n/client";

type Report = {
  id: string;
  studentName: string | null;
  grade: string;
  symptoms: string[];
  otherNote: string | null;
  reportedAt: string;
};

const SYMPTOMS = ["NAUSEA", "VOMITING", "DIARRHEA", "FEVER", "ABDOMINAL_PAIN", "OTHER"] as const;

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Медбике: баланың толық аты-жөні, сыныбы, белгілері; «Басқа» таңдалса — сипаттамасы.
// Аты-жөні тек осы бетте көрінеді, СЭС-ке сынып пен белгілер ғана барады.
export default function NursePage() {
  const t = useT();
  const n = t.nurse;
  const { data, mutate: load } = useSWR<{ reports?: Report[] }>("/api/nurse/reports", fetcher);
  const reports = data?.reports ?? [];
  const [studentName, setStudentName] = useState("");
  const [grade, setGrade] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [otherNote, setOtherNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const withOther = symptoms.includes("OTHER");

  function toggleSymptom(s: string) {
    setSymptoms((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (symptoms.length === 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/nurse/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName, grade, symptoms, otherNote: withOther ? otherNote : undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: body.error ?? t.common.error });
        return;
      }
      setMessage({ ok: true, text: body.alertCreated ? n.registeredRed : n.registered });
      setStudentName("");
      setGrade("");
      setSymptoms([]);
      setOtherNote("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen pb-24">
      <AppHeader subtitle={n.subtitle} roleLabel={t.roles.nurse} />

      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <form onSubmit={handleSubmit} className="card space-y-4 border border-line p-4">
          <h2 className="font-bold text-ink">{n.formTitle}</h2>

          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <label className="block">
              <span className="text-sm font-medium text-ink">{n.studentName}</span>
              <input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder={n.studentNamePlaceholder}
                required
                minLength={3}
                maxLength={100}
                autoComplete="off"
                className="field mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">{n.grade}</span>
              <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder={n.gradePlaceholder} required maxLength={10} className="field mt-1" />
            </label>
          </div>

          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-ink">{n.symptoms}</legend>
            <div className="grid grid-cols-2 gap-2">
              {SYMPTOMS.map((key) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={symptoms.includes(key)}
                  onClick={() => toggleSymptom(key)}
                  className={`rounded-xl border py-3 text-sm font-medium ${
                    symptoms.includes(key) ? "border-bad-600 bg-bad-600 text-white" : "border-line-strong bg-surface text-ink"
                  }`}
                >
                  {t.symptoms[key]}
                </button>
              ))}
            </div>
          </fieldset>

          {withOther && (
            <label className="block">
              <span className="text-sm font-medium text-ink">{n.otherNote}</span>
              <textarea
                value={otherNote}
                onChange={(e) => setOtherNote(e.target.value)}
                placeholder={n.otherNotePlaceholder}
                required
                maxLength={200}
                rows={2}
                className="field mt-1"
              />
            </label>
          )}

          <p className="text-xs text-muted">{n.privacy}</p>

          {message && (
            <p role={message.ok ? "status" : "alert"} className={`text-sm font-medium ${message.ok ? "text-primary" : "text-bad-700"}`}>
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || symptoms.length === 0}
            className="btn w-full border border-bad-600 bg-bad-600 py-3.5 text-base text-white hover:bg-bad-800"
          >
            {submitting ? n.submitting : n.submit}
          </button>
        </form>

        <section className="space-y-2">
          <h2 className="font-bold text-ink">{n.last24}</h2>
          {reports.length === 0 && <p className="text-sm text-muted">{n.empty}</p>}
          {reports.map((r) => (
            <div key={r.id} className="card flex items-center justify-between gap-3 border border-line p-3">
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {r.studentName ?? "—"} · {n.gradeLabel(r.grade)}
                </p>
                <p className="text-xs text-muted">
                  {r.symptoms.map((s) => t.symptoms[s] ?? s).join(", ")}
                  {r.otherNote ? ` (${r.otherNote})` : ""}
                </p>
              </div>
              <p className="shrink-0 text-xs text-muted">{hm(r.reportedAt)}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
