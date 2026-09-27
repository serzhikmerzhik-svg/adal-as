"use client";

import { useState } from "react";
import { ingredientMatches } from "@/lib/plan";
import { useT } from "@/i18n/client";
import type { BatchOption, DishCategory, PlanItem } from "./types";

const CATEGORIES: DishCategory[] = ["SOUP", "MAIN", "HOT_DRINK", "COLD"];

/**
 * Мәзірге тағам қосу. Мектеп пен балабақша тағамды СЭС бекіткен жоспардан таңдайды; жоспардан тыс тағам
 * тек себебімен қосылады. Негізгі өнім партиясы техкартаға сай келмесе, бірден ескертеміз (сервер алерт береді).
 */
export function AddDishForm({
  withPlan,
  plan,
  planDay,
  takenPlanIds,
  batches,
  onDone,
}: {
  withPlan: boolean;
  plan: PlanItem[];
  planDay: number | null;
  takenPlanIds: string[];
  batches: BatchOption[];
  onDone: (error: string | null) => void;
}) {
  const t = useT();
  const p = t.plan;
  const k = t.kitchen;
  const available = plan.filter((item) => !takenPlanIds.includes(item.id));
  const [mode, setMode] = useState<"plan" | "free">(withPlan && available.length > 0 ? "plan" : "free");
  const [planItemId, setPlanItemId] = useState(available[0]?.id ?? "");
  const [batchId, setBatchId] = useState("");
  const [busy, setBusy] = useState(false);

  const planItem = plan.find((item) => item.id === planItemId);
  const batch = batches.find((b) => b.id === batchId);
  const mismatch = mode === "plan" && planItem && batch && !ingredientMatches(planItem.mainIngredient, batch.product);

  async function submit(form: FormData) {
    setBusy(true);
    const body =
      mode === "plan"
        ? { planItemId, batchId: batchId || undefined }
        : {
            name: form.get("name"),
            category: form.get("category"),
            standardPortionG: form.get("portion") ? Number(form.get("portion")) : undefined,
            offPlanReason: withPlan ? form.get("reason") : undefined,
            batchId: batchId || undefined,
          };
    try {
      const res = await fetch("/api/kitchen/menu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      onDone(res.ok ? null : (data.error ?? t.common.error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="card space-y-3 border border-line p-4">
      {withPlan && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {p.title}
            {planDay ? ` · ${p.day(planDay)}` : ""}
          </p>
          <div className="seg" role="group" aria-label={p.title}>
            <button type="button" aria-pressed={mode === "plan"} onClick={() => setMode("plan")} disabled={available.length === 0}>
              {p.pick}
            </button>
            <button type="button" aria-pressed={mode === "free"} onClick={() => setMode("free")}>
              {p.offPlan}
            </button>
          </div>
        </>
      )}

      {mode === "plan" ? (
        <>
          <select value={planItemId} onChange={(e) => setPlanItemId(e.target.value)} className="field" aria-label={p.choose} required>
            {available.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {t.norms.categories[item.category]} · {t.common.grams(item.portionG)}
              </option>
            ))}
          </select>
          {planItem && (
            <p className="rounded-lg bg-page px-3 py-2 text-xs text-ink-2">
              <span className="font-semibold text-ink">{p.composition}:</span> {planItem.composition}
            </p>
          )}
        </>
      ) : (
        <>
          <input name="name" required maxLength={80} placeholder={k.dishName} aria-label={k.dishName} className="field" />
          <div className="grid grid-cols-2 gap-2">
            <select name="category" className="field" aria-label={t.norms.category} defaultValue="MAIN">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t.norms.categories[c]}
                </option>
              ))}
            </select>
            <input name="portion" type="number" inputMode="numeric" min={1} placeholder={k.portionG} aria-label={k.portionG} className="field" />
          </div>
          {withPlan && (
            <>
              <input name="reason" required maxLength={200} placeholder={p.offPlanReason} aria-label={p.offPlanReason} className="field" />
              <p className="text-xs font-medium text-warn-700">{p.offPlanWarn}</p>
            </>
          )}
        </>
      )}

      <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="field" aria-label={p.batch}>
        <option value="">
          {p.batch}: {p.noBatch}
        </option>
        {batches.map((b) => (
          <option key={b.id} value={b.id} disabled={b.supplier.blocked}>
            {b.code} · {b.product} · {b.supplier.name}
            {b.supplier.blocked ? ` ${k.blockedSuffix}` : ""}
          </option>
        ))}
      </select>
      {mismatch && (
        <p role="alert" className="rounded-lg bg-warn-50 px-3 py-2 text-xs font-semibold text-warn-700">
          {p.mismatch(planItem.mainIngredient, batch.product)}
        </p>
      )}

      <button type="submit" className="btn btn-primary w-full" disabled={busy || (mode === "plan" && !planItemId)}>
        {k.add}
      </button>
    </form>
  );
}
