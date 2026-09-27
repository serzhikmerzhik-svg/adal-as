"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { LevelPill } from "@/components/ui";
import type { SupplierRow } from "./types";
import { fullDate } from "@/lib/format";

function certText(s: SupplierRow) {
  if (s.certDaysLeft < 0) return <span className="font-semibold text-bad-700">Мерзімі өткен</span>;
  if (s.certDaysLeft <= 30) return <span className="font-semibold text-warn-700">{s.certDaysLeft} күн қалды</span>;
  return <span className="text-muted">Жарамды</span>;
}

function warningLetter(s: SupplierRow) {
  const until = fullDate(s.certificateValidUntil);
  return (
    `Құрметті ${s.name} басшылығы!\n\n` +
    `Сіздің өніміңізге берілген сәйкестік сертификатының мерзімі ${until} аяқталады (${s.certDaysLeft} күн қалды). ` +
    `Маңғыстау облысы СЭС департаменті жаңартылған сертификатты мерзімі біткенге дейін ұсынуды сұрайды. ` +
    `Сертификат ұсынылмаса, облыстағы асханаларға жеткізілімдер тоқтатылады.\n\nМаңғыстау облысы СЭС департаменті`
  );
}

export function SuppliersCard({
  suppliers,
  onChanged,
  limit,
  readOnly = false,
}: {
  suppliers: SupplierRow[];
  onChanged?: () => void;
  limit?: number;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const rows = limit ? suppliers.slice(0, limit) : suppliers;

  async function block(s: SupplierRow) {
    if (!window.confirm(`${s.name} жеткізушісін бұғаттайсыз ба? Оның партиялары бар нысандардың тәуекелі қайта есептеледі.`)) return;
    setBusy(s.id);
    try {
      await fetch(`/api/ses/suppliers/${s.id}/block`, { method: "PATCH" });
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  async function copyWarning(s: SupplierRow) {
    await navigator.clipboard.writeText(warningLetter(s));
    setCopied(s.id);
    setTimeout(() => setCopied(null), 3000);
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-[17px] font-semibold text-ink">Жеткізушілер тәуекелі</h2>
        <p className="text-xs text-muted">Бір жеткізуші бірнеше нысанға — бір тәуекел бірнеше нысанға</p>
      </div>
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="table-head text-left border-b border-line">
              <th className="py-2 pr-3 font-medium">Жеткізуші</th>
              <th className="py-2 pr-3 font-medium">Өнім</th>
              <th className="py-2 pr-3 font-medium">Нысандар</th>
              <th className="py-2 pr-3 font-medium">Сертификат</th>
              <th className="py-2 pr-3 font-medium">Мәртебе</th>
              {!readOnly && <th className="py-2 font-medium">Әрекет</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <Fragment key={s.id}>
                <tr className="border-b border-line align-middle">
                  <td className="py-3 pr-3 font-semibold text-ink">{s.name}</td>
                  <td className="py-3 pr-3 text-ink">{s.products.join(", ")}</td>
                  <td className="py-3 pr-3 font-mono tabular-nums">{s.facilities}</td>
                  <td className="py-3 pr-3">{certText(s)}</td>
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-2">
                      <LevelPill level={s.status} />
                      {s.note && <span className={`text-xs ${s.status === "RED" ? "text-bad-700" : "text-muted"}`}>{s.note}</span>}
                    </span>
                  </td>
                  {!readOnly && (
                    <td className="py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {s.status === "RED" && !s.blocked && (
                          <button type="button" className="btn btn-danger btn-sm" disabled={busy === s.id} onClick={() => block(s)}>
                            {busy === s.id ? "..." : "Бұғаттау"}
                          </button>
                        )}
                        {s.blocked && <span className="text-xs font-semibold text-bad-700">Бұғатталған</span>}
                        {s.status === "YELLOW" && (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => copyWarning(s)}
                            title="Ескерту хатының мәтіні алмасу буферіне көшіріледі"
                          >
                            {copied === s.id ? "Хат мәтіні көшірілді" : "Ескерту жіберу"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-xs text-primary underline"
                          aria-expanded={open === s.id}
                          onClick={() => setOpen(open === s.id ? null : s.id)}
                        >
                          Партиялар
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
                {open === s.id && (
                  <tr className="border-b border-line bg-page/60">
                    <td colSpan={6} className="px-3 py-3">
                      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {s.batches.slice(0, 9).map((b) => (
                          <div key={b.id} className="rounded-md bg-surface border border-line px-3 py-2 text-xs">
                            <span className={`font-mono font-medium ${b.linkedToRed ? "text-bad-700" : "text-ink"}`}>{b.code}</span>{" "}
                            · {b.product} · {b.facilities} нысан
                            <span className="block text-muted">
                              Жарамды: {fullDate(b.expiresAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {limit && suppliers.length > limit && (
        <Link href="/ses/suppliers" className="mt-3 inline-block text-xs text-primary underline">
          Барлық жеткізушілер ({suppliers.length})
        </Link>
      )}
    </section>
  );
}
