"use client";

import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { THEME } from "@/lib/theme";
import { ddmm, hm } from "@/lib/format";
import { issueLabels } from "@/lib/photo/verdict";
import { ingredientMatches } from "@/lib/plan";
import { EATABILITY, TEMP } from "@/lib/risk/config";
import { useT } from "@/i18n/client";

type Log = { type: string; valueC: number | null; isViolation: boolean; source: string; aiStatus: string | null; aiWastePct: number | null; createdAt: string };

export type FacilityOps = {
  todayMenu: {
    id: string;
    name: string;
    category: string;
    offPlanReason: string | null;
    planItem: { mainIngredient: string } | null;
    batch: { code: string; product: string } | null;
    logs: Log[];
  }[];
  devices: { id: string; kind: string; label: string; lastSeenAt: string | null; lastValue: number | null; readings: { value: number; createdAt: string }[] }[];
  staff: { id: string; label: string; checks: { aiStatus: string; aiIssues: string[]; createdAt: string }[] }[];
  waste: { id: string; aiWastePct: number | null; createdAt: string; menuItem: { name: string } | null }[];
};

const ONLINE_MS = 10 * 60_000;

/** СЭС-ке нысанның бүгінгі жұмысы: мәзір мен техкарта, температура (құрылғыдан да), фото, жеу индексі, датчиктер, персонал. */
export function FacilityOpsCard({ ops, withPlan, generatedAt }: { ops: FacilityOps; withPlan: boolean; generatedAt: number }) {
  const t = useT();
  const p = t.schoolPage;
  const cleared = ops.staff.filter((s) => s.checks[0]?.aiStatus === "OK").length;

  return (
    <section className="card space-y-5 p-4" aria-labelledby="ops-title">
      <h2 id="ops-title" className="font-bold text-ink">
        {p.todayTitle}
      </h2>

      {/* Бүгінгі мәзір: әр тағам бір жолда */}
      {ops.todayMenu.length === 0 ? (
        <p className="text-sm text-muted">{p.noMenuToday}</p>
      ) : (
        <ul className="divide-y divide-line">
          {ops.todayMenu.map((m) => {
            const hot = m.logs.find((l) => l.type === "HOT_TEMP");
            const photo = m.logs.find((l) => l.type === "PHOTO");
            const waste = m.logs.find((l) => l.type === "WASTE" && l.aiWastePct !== null);
            const mismatch = m.planItem && m.batch && !ingredientMatches(m.planItem.mainIngredient, m.batch.product);
            return (
              <li key={m.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2 text-sm">
                <span className="min-w-40 flex-1 font-medium text-ink">
                  {m.name}
                  {withPlan && (
                    <span className={`ml-2 text-xs font-semibold ${m.offPlanReason ? "text-warn-700" : "text-ok-700"}`}>
                      {m.offPlanReason ? t.plan.offPlanBadge : t.plan.inPlan}
                    </span>
                  )}
                </span>
                {m.batch && (
                  <span className={`text-xs ${mismatch ? "font-semibold text-warn-700" : "text-muted"}`}>
                    {mismatch ? `! ${t.plan.mismatch(m.planItem!.mainIngredient, m.batch.product)}` : `${m.batch.product} · ${m.batch.code}`}
                  </span>
                )}
                <span className={`font-mono text-xs ${hot ? (hot.isViolation ? "text-bad-700" : "text-ok-700") : "text-muted"}`}>
                  {hot?.valueC != null ? `${hot.valueC} °C ${hot.isViolation ? "!" : "✓"}${hot.source === "DEVICE" ? ` · ${t.devices.fromDevice}` : ""}` : `${t.kitchen.steps.temp}: —`}
                </span>
                <span className="text-xs text-muted">{photo?.aiStatus ? t.photoStatus[photo.aiStatus] : `${t.kitchen.steps.photo}: —`}</span>
                {waste?.aiWastePct != null && (
                  <span className={`text-xs font-semibold ${100 - waste.aiWastePct < EATABILITY.LOW_PCT ? "text-bad-700" : "text-ok-700"}`}>
                    {t.waste.eatability(100 - waste.aiWastePct)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Құрылғылар мен тоңазытқыш датчигі */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">{p.devicesTitle}</h3>
        {ops.devices.length === 0 && <p className="text-sm text-muted">{p.noDevices}</p>}
        {ops.devices.map((d) => {
          const online = !!d.lastSeenAt && generatedAt - Date.parse(d.lastSeenAt) < ONLINE_MS;
          const chart = d.readings.map((r) => ({ time: hm(r.createdAt), value: r.value }));
          return (
            <div key={d.id} className="space-y-2 rounded-lg border border-line p-3">
              <p className="text-sm text-ink">
                <i aria-hidden="true" className={`mr-1.5 inline-block h-2 w-2 rounded-full ${online ? "bg-ok-500" : "bg-muted"}`} />
                {d.label} · <span className="text-muted">{t.devices.kinds[d.kind]}</span>
                {d.lastValue !== null && <span className="font-mono"> · {d.lastValue} °C</span>}
                <span className="text-muted"> · {online ? t.devices.online : t.devices.offline}</span>
              </p>
              {d.kind === "FRIDGE" && chart.length > 1 && (
                <figure>
                  <figcaption className="mb-1 text-xs text-muted">{p.fridge24h}</figcaption>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chart} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} vertical={false} />
                        <ReferenceArea y1={TEMP.FRIDGE_MIN} y2={TEMP.FRIDGE_MAX} fill={THEME.green} fillOpacity={0.08} stroke="none" />
                        <XAxis dataKey="time" fontSize={10} tick={{ fill: THEME.tick }} minTickGap={32} />
                        <YAxis fontSize={10} tick={{ fill: THEME.tick }} domain={[0, (max: number) => Math.max(12, Math.ceil(max + 1))]} />
                        <Tooltip {...THEME.tooltip} formatter={(v) => [`${v} °C`, d.label]} />
                        <Line type="monotone" dataKey="value" stroke={THEME.primary} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-muted">{p.fridgeNorm}</p>
                </figure>
              )}
            </div>
          );
        })}
      </div>

      {/* Смена алдындағы тексеру */}
      {ops.staff.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">
            {t.staff.title} · <span className={cleared === ops.staff.length ? "text-ok-700" : "text-warn-700"}>{t.staff.summary(cleared, ops.staff.length)}</span>
          </h3>
          <ul className="space-y-1 text-sm">
            {ops.staff.map((s) => {
              const c = s.checks[0];
              return (
                <li key={s.id} className="flex flex-wrap justify-between gap-2">
                  <span className="text-ink">{s.label}</span>
                  <span className={`text-xs font-medium ${!c ? "text-muted" : c.aiStatus === "OK" ? "text-ok-700" : c.aiStatus === "FLAGGED" ? "text-bad-700" : "text-muted"}`}>
                    {!c
                      ? t.staff.notChecked
                      : c.aiStatus === "OK"
                        ? t.staff.admitted(hm(c.createdAt))
                        : c.aiStatus === "FLAGGED"
                          ? `${t.staff.notAdmitted} · ${issueLabels(c.aiIssues, t.photoIssues).join(", ")}`
                          : t.photoStatus[c.aiStatus]}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Жеу индексі, соңғы 7 күн */}
      {withPlan && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">{p.eatTitle}</h3>
          {ops.waste.length === 0 ? (
            <p className="text-sm text-muted">{p.noEat}</p>
          ) : (
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {ops.waste.slice(0, 8).map((w) => {
                const eaten = 100 - (w.aiWastePct ?? 0);
                return (
                  <li key={w.id} className="flex justify-between gap-2">
                    <span className="truncate text-ink">
                      {ddmm(w.createdAt)} · {w.menuItem?.name ?? "—"}
                    </span>
                    <span className={`font-mono text-xs font-semibold ${eaten < EATABILITY.LOW_PCT ? "text-bad-700" : "text-ok-700"}`}>{eaten}%</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
