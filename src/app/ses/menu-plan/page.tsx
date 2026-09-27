"use client";

import { useState } from "react";
import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import { fullDate } from "@/lib/format";
import { useT } from "@/i18n/client";

type PlanItem = {
  id: string;
  kind: "SCHOOL" | "KINDERGARTEN";
  day: number;
  name: string;
  category: string;
  portionG: number;
  mainIngredient: string;
  composition: string;
  approvedAt: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Екі апталық мәзір жоспары: асхана тағамды осыдан таңдайды, ауытқу СЭС-ке алерт береді.
export default function MenuPlanPage() {
  const t = useT();
  const p = t.plan;
  const [kind, setKind] = useState<"SCHOOL" | "KINDERGARTEN">("SCHOOL");
  const { data } = useSWR<{ items: PlanItem[]; today: number; days: number }>("/api/ses/menu-plan", fetcher);

  const items = (data?.items ?? []).filter((i) => i.kind === kind);
  const days = Array.from({ length: data?.days ?? 14 }, (_, i) => i + 1);

  return (
    <main className="min-h-screen pb-10">
      <AppHeader subtitle={p.pageTitle} roleLabel={t.roles.ses} sesNav />
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <section className="card flex flex-wrap items-end justify-between gap-3 p-4">
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-ink">{p.pageTitle}</h1>
            <p className="mt-1 text-sm text-muted">{p.pageHint}</p>
            {items[0] && <p className="mt-1 text-xs text-muted">{p.approved(fullDate(items[0].approvedAt))}</p>}
          </div>
          <div className="seg" role="group" aria-label={t.schoolsPage.kindAria}>
            {(["SCHOOL", "KINDERGARTEN"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
                {t.kindsPlural[k]}
              </button>
            ))}
          </div>
        </section>

        {!data ? (
          <p className="p-6 text-center text-muted">{t.common.loading}</p>
        ) : (
          [1, 2].map((week) => (
            <section key={week} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{p.week(week)}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {days
                  .filter((d) => Math.ceil(d / 7) === week)
                  .map((d) => {
                    const today = d === data.today;
                    return (
                      <article key={d} className={`card space-y-2 p-3 ${today ? "ring-2 ring-primary" : ""}`}>
                        <p className="flex items-baseline justify-between text-xs font-semibold text-muted">
                          <span>{p.day(d)}</span>
                          {today && <span className="text-primary">{p.todayMark}</span>}
                        </p>
                        {items
                          .filter((i) => i.day === d)
                          .map((i) => (
                            <div key={i.id} title={i.composition}>
                              <p className="text-sm font-medium leading-snug text-ink">{i.name}</p>
                              <p className="text-xs text-muted">
                                {t.norms.categories[i.category]} · {t.common.grams(i.portionG)} · {i.mainIngredient}
                              </p>
                            </div>
                          ))}
                      </article>
                    );
                  })}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
