"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import { fetcher } from "@/components/ses/types";
import { useT } from "@/i18n/client";

type Step = "step1" | "step2" | "fridge" | "reset";
type Info = { school: string; batch: { code: string; product: string } | null; recipients: string[] };

/** Питч пен оқыту кезінде негізгі сценарийді нақты API арқылы ретімен іске қосады. */
export default function TrainingPage() {
  const t = useT();
  const tr = t.training;
  const [log, setLog] = useState<{ ok: boolean; text: string; at: string }[]>([]);
  const [busy, setBusy] = useState<Step | null>(null);
  const [alertId, setAlertId] = useState<string | null>(null);
  const { data: info } = useSWR<Info>("/api/training", fetcher);

  const school = info?.school ?? tr.schoolFallback;
  const batch = info?.batch ? tr.batch(info.batch.code, info.batch.product) : tr.batchFallback;
  const recipients = info?.recipients.length ? info.recipients.join(", ") : tr.recipientsFallback;
  const steps: { id: "step1" | "step2" | "fridge"; title: string; text: string; button: string; tone: "primary" | "danger" }[] = [
    { id: "step1", title: tr.step1Title(school), text: tr.step1Text(batch), button: tr.step1Btn, tone: "primary" },
    { id: "step2", title: tr.step2Title, text: tr.step2Text(recipients), button: tr.step2Btn, tone: "danger" },
  ];

  function describe(step: Step, data: Record<string, unknown>) {
    if (step === "step1") return tr.step1Done(school, t.levels[String(data.riskLevel)] ?? String(data.riskLevel));
    if (step === "step2") {
      if (!data.alertCreated) return tr.step2Exists;
      return tr.step2Done(((data.traced as string[] | undefined) ?? []).join(", ") || "—");
    }
    if (step === "fridge") return tr.fridgeDone(Number(data.peak));
    return tr.resetDone;
  }

  async function run(step: Step) {
    setBusy(step);
    const at = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    try {
      const res = await fetch(`/api/training/${step}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setLog((l) => [{ ok: false, text: data.error ?? t.common.error, at }, ...l]);
        return;
      }
      if ((step === "step2" || step === "fridge") && data.alertId) setAlertId(data.alertId);
      if (step === "reset") setAlertId(null);
      setLog((l) => [{ ok: true, text: describe(step, data), at }, ...l]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen pb-10">
      <AppHeader subtitle={tr.subtitle} />

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <section className="card p-5">
          <h1 className="text-lg font-semibold text-ink">{tr.title}</h1>
          <p className="mt-1 text-sm text-muted">{tr.intro}</p>
        </section>

        {steps.map((s) => (
          <section key={s.id} className="card space-y-3 p-5">
            <div>
              <h2 className="font-semibold text-ink">{s.title}</h2>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
            <button
              type="button"
              onClick={() => run(s.id)}
              disabled={busy !== null}
              className={`btn w-full ${s.tone === "danger" ? "btn-danger" : "btn-primary"}`}
            >
              {busy === s.id ? tr.running : s.button}
            </button>
          </section>
        ))}

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold text-ink">{tr.step3Title}</h2>
          <p className="text-sm text-muted">{tr.step3Text}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/ses" className="btn btn-outline">
              {tr.sesLink}
            </Link>
            {alertId && (
              <Link href={`/ses/alerts/${alertId}`} className="btn btn-outline">
                {tr.alertLink}
              </Link>
            )}
          </div>
        </section>

        <section className="card space-y-3 border border-line p-5">
          <div>
            <h2 className="font-semibold text-ink">{tr.fridgeTitle}</h2>
            <p className="mt-1 text-sm text-muted">{tr.fridgeText(school)}</p>
          </div>
          <button type="button" onClick={() => run("fridge")} disabled={busy !== null} className="btn btn-danger w-full">
            {busy === "fridge" ? tr.running : tr.fridgeBtn}
          </button>
        </section>

        <button type="button" onClick={() => run("reset")} disabled={busy !== null} className="btn btn-outline w-full">
          {busy === "reset" ? tr.resetting : tr.reset}
        </button>

        <section className="card max-h-64 space-y-1.5 overflow-y-auto p-4 text-sm" aria-live="polite">
          {log.length === 0 && <p className="text-muted">{tr.logEmpty}</p>}
          {log.map((l, i) => (
            <p key={i} className={l.ok ? "text-ink" : "text-bad-700"}>
              <span className="mr-2 font-mono text-xs text-muted">{l.at}</span>
              {l.text}
            </p>
          ))}
        </section>
      </div>
    </main>
  );
}
