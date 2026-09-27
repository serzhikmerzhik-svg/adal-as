"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import { fetcher } from "@/components/ses/types";

type Step = "step1" | "step2" | "reset";
type Info = { school: string; batch: { code: string; product: string } | null; recipients: string[] };

function steps(info?: Info): { id: Exclude<Step, "reset">; title: string; text: string; tone: "primary" | "danger" }[] {
  const school = info?.school ?? "Мектеп";
  const batch = info?.batch ? `${info.batch.code} партиясы (${info.batch.product.toLowerCase()})` : "Бүгінгі партия";
  const recipients = info?.recipients.length ? info.recipients.join(", ") : "басқа нысандар";
  return [
    {
      id: "step1",
      title: `1. ${school} асханасы күнделікті журналды толтырады`,
      text: `Бүгінгі мәзір, порция фотосы және тоңазытқыш пен ыстық тағам температурасы. ${batch} мәзірге байланады.`,
      tone: "primary",
    },
    {
      id: "step2",
      title: "2. Медбике 4 оқушыда ішек-қарын белгілерін тіркейді",
      text: `10 минут ішінде 4 тіркеу — кластер. Жүйе қызыл дабыл береді, мәзірді бұғаттайды, сол партияны алған ${recipients} нысандарын сарыға көтереді.`,
      tone: "danger",
    },
  ];
}

function describe(step: Step, data: Record<string, unknown>, school: string) {
  if (step === "step1") return `Мәзір толтырылды · ${school} деңгейі: ${data.riskLevel === "GREEN" ? "жасыл" : String(data.riskLevel)}`;
  if (step === "step2") {
    if (!data.alertCreated) return "Кластер бұрыннан тіркелген: жаңа дабыл жоқ";
    const traced = (data.traced as string[] | undefined) ?? [];
    return `Қызыл дабыл іске қосылды · партия бойынша сарыға көтерілді: ${traced.join(", ") || "—"}`;
  }
  return "Бастапқы күйге қайтарылды";
}

/** Питч пен оқыту кезінде негізгі сценарийді нақты API арқылы ретімен іске қосады. */
export default function TrainingPage() {
  const [log, setLog] = useState<{ ok: boolean; text: string; at: string }[]>([]);
  const [busy, setBusy] = useState<Step | null>(null);
  const [alertId, setAlertId] = useState<string | null>(null);
  const { data: info } = useSWR<Info>("/api/training", fetcher);

  async function run(step: Step) {
    setBusy(step);
    const at = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    try {
      const res = await fetch(`/api/training/${step}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setLog((l) => [{ ok: false, text: data.error ?? "Қате шықты", at }, ...l]);
        return;
      }
      if (step === "step2" && data.alertId) setAlertId(data.alertId);
      if (step === "reset") setAlertId(null);
      setLog((l) => [{ ok: true, text: describe(step, data, info?.school ?? "Нысан"), at }, ...l]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen pb-10">
      <AppHeader subtitle="Оқу-жаттығу режимі" />

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <section className="card p-5">
          <h1 className="text-lg font-semibold text-ink">Негізгі сценарий: белгі → дабыл → партия → нұсқама</h1>
          <p className="mt-1 text-sm text-muted">
            Қадамдар нақты API арқылы жүреді: асхана мен медбикенің қосымшасы жасайтын жазбалар жасалады, тәуекелді
            сол логика есептейді. СЭС бетін екінші терезеде ашып қойыңыз — өзгеріс 5 секунд ішінде шығады.
          </p>
        </section>

        {steps(info).map((s) => (
          <section key={s.id} className="card p-5 space-y-3">
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
              {busy === s.id ? "Орындалуда..." : s.id === "step1" ? "Журналды толтыру" : "Белгілерді тіркеу"}
            </button>
          </section>
        ))}

        <section className="card p-5 space-y-3">
          <h2 className="font-semibold text-ink">3. СЭС инспекторы әрекет етеді</h2>
          <p className="text-sm text-muted">
            Дабылды қабылдайды, кенет тексеру тағайындайды, қажет болса жеткізушіні бұғаттап, нұсқама береді.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/ses" className="btn btn-outline">СЭС бақылау орталығы →</Link>
            {alertId && (
              <Link href={`/ses/alerts/${alertId}`} className="btn btn-outline">Қызыл дабыл карточкасы →</Link>
            )}
          </div>
        </section>

        <button type="button" onClick={() => run("reset")} disabled={busy !== null} className="btn btn-outline w-full">
          {busy === "reset" ? "Қайтарылуда..." : "Бастапқы күйге қайтару"}
        </button>

        <section className="card p-4 space-y-1.5 text-sm max-h-64 overflow-y-auto" aria-live="polite">
          {log.length === 0 && <p className="text-muted">Әрекет журналы бос.</p>}
          {log.map((l, i) => (
            <p key={i} className={l.ok ? "text-ink" : "text-bad-700"}>
              <span className="font-mono text-xs text-muted mr-2">{l.at}</span>
              {l.text}
            </p>
          ))}
        </section>
      </div>
    </main>
  );
}
