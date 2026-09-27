"use client";

import { useState, type ReactNode } from "react";
import { issueLabels } from "@/lib/photo/verdict";
import { ingredientMatches } from "@/lib/plan";
import { serveNorm } from "@/lib/temperature";
import { EATABILITY } from "@/lib/risk/config";
import { useT } from "@/i18n/client";
import type { MenuItem } from "./types";

type Props = {
  item: MenuItem;
  withPlan: boolean;
  hasProbe: boolean;
  busyKey: string | null;
  /** «Өлшеу» басылған тағам және ол қашанға дейін күтеді. */
  measuringUntil: number | null;
  now: number;
  onPhoto: () => void;
  onWaste: () => void;
  onMeasure: () => void;
  onCancelMeasure: () => void;
  onTemp: (value: number) => Promise<void>;
};

type Tone = "ok" | "bad" | "warn" | "info" | "muted";
const TONE: Record<Tone, string> = {
  ok: "text-ok-700",
  bad: "text-bad-700",
  warn: "text-warn-700",
  info: "text-primary",
  muted: "text-muted",
};
const BORDER: Record<Tone, string> = {
  ok: "border-ok-500/60",
  bad: "border-bad-600",
  warn: "border-warn-500",
  info: "border-primary",
  muted: "border-line",
};

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
    {d}
  </svg>
);
const ThermometerIcon = () => icon(<path d="M10 4a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0Zm2 12v-6" />);
const CameraIcon = () =>
  icon(
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4Z" />
      <circle cx="12" cy="13" r="3.2" />
    </>,
  );
const PlateIcon = () =>
  icon(
    <>
      <circle cx="12" cy="13" r="7" />
      <circle cx="12" cy="13" r="3.5" />
      <path d="M5 4v3M19 4v3" />
    </>,
  );

/** Бір әрекет: белгіше, атауы және күйі (жасалмаған / норма / мәселе). */
function Tile({ label, status, tone, onClick, disabled, pressed, children }: {
  label: string;
  status: string;
  tone: Tone;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 bg-page px-2 py-3 text-center transition-colors hover:bg-surface-2 disabled:opacity-60 ${BORDER[tone]} ${pressed ? "bg-surface-2" : ""}`}
    >
      <span className={TONE[tone === "muted" ? "info" : tone]}>{children}</span>
      <span className="text-sm font-semibold leading-tight text-ink">{label}</span>
      <span className={`text-xs font-medium leading-tight ${TONE[tone]}`}>{status}</span>
    </button>
  );
}

/** Бүгінгі мәзірдегі бір тағам: температура, порция фотосы және қалдық — үш үлкен тақтайша. */
export function DishCard({ item, withPlan, hasProbe, busyKey, measuringUntil, now, onPhoto, onWaste, onMeasure, onCancelMeasure, onTemp }: Props) {
  const t = useT();
  const k = t.kitchen;
  const n = t.norms;
  const [tempOpen, setTempOpen] = useState(false);
  const [value, setValue] = useState("");

  const lastPhoto = item.logs.find((l) => l.type === "PHOTO");
  const lastHot = item.logs.find((l) => l.type === "HOT_TEMP");
  const lastWaste = item.logs.find((l) => l.type === "WASTE");
  const norm = serveNorm(item.category);
  const normText = norm.min !== undefined ? n.min(norm.min) : norm.max !== undefined ? n.max(norm.max) : "";
  const mismatch = item.planItem && item.batch && !ingredientMatches(item.planItem.mainIngredient, item.batch.product);
  const eaten = lastWaste?.aiWastePct != null ? 100 - lastWaste.aiWastePct : null;
  const measuring = measuringUntil !== null;

  const temp = lastHot?.valueC != null
    ? { status: `${lastHot.valueC} °C ${lastHot.isViolation ? "!" : "✓"}`, tone: (lastHot.isViolation ? "bad" : "ok") as Tone }
    : { status: k.notDone, tone: "muted" as Tone };
  const photo = !lastPhoto
    ? { status: k.notDone, tone: "muted" as Tone }
    : lastPhoto.aiStatus === "PENDING"
      ? { status: k.photoPending, tone: "info" as Tone }
      : lastPhoto.aiStatus === "FLAGGED"
        ? { status: `${k.photoFlagged} !`, tone: "warn" as Tone }
        : { status: `${k.photoOk} ✓`, tone: "ok" as Tone };
  const waste =
    lastWaste?.aiStatus === "PENDING"
      ? { status: k.photoPending, tone: "info" as Tone }
      : eaten !== null
        ? { status: k.eaten(eaten), tone: (eaten < EATABILITY.LOW_PCT ? "bad" : "ok") as Tone }
        : { status: k.afterLunch, tone: "muted" as Tone };

  const verdict =
    lastHot?.valueC != null
      ? lastHot.isViolation
        ? norm.min !== undefined
          ? n.tooCold(lastHot.valueC, norm.min)
          : n.tooWarm(lastHot.valueC, norm.max ?? 0)
        : n.ok(lastHot.valueC)
      : null;

  async function save() {
    const v = Number(value.replace(",", "."));
    if (value.trim() === "" || Number.isNaN(v)) return;
    await onTemp(v);
    setValue("");
    setTempOpen(false);
  }

  return (
    <article className={`card space-y-3 border p-4 ${item.blocked ? "border-bad-300" : "border-line"}`}>
      {item.blocked && <p className="rounded-lg bg-bad-50 px-3 py-2 text-sm font-bold text-bad-700">{k.blocked}</p>}

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-snug text-ink">{item.name}</h3>
          <p className="text-xs text-muted">
            {n.categories[item.category]}
            {item.standardPortionG ? ` · ${t.common.grams(item.standardPortionG)}` : ""}
            {normText ? ` · ${normText}` : ""}
          </p>
        </div>
        {withPlan && (
          <span className={`chip shrink-0 ${item.planItemId ? "text-ok-700" : "text-warn-700"}`}>
            {item.planItemId ? t.plan.inPlan : t.plan.offPlanBadge}
          </span>
        )}
      </header>

      {mismatch && (
        <p role="alert" className="rounded-lg bg-warn-50 px-3 py-2 text-xs font-semibold text-warn-700">
          {t.plan.mismatch(item.planItem!.mainIngredient, item.batch!.product)}
        </p>
      )}

      <div className={`grid gap-2 ${withPlan ? "grid-cols-3" : "grid-cols-2"}`}>
        <Tile label={k.tileTemp} status={measuring ? t.devices.measure : temp.status} tone={measuring ? "info" : temp.tone} pressed={tempOpen || measuring} onClick={() => setTempOpen((v) => !v)}>
          <ThermometerIcon />
        </Tile>
        <Tile label={k.tilePhoto} status={busyKey === item.id ? k.uploading : photo.status} tone={photo.tone} disabled={busyKey === item.id} onClick={onPhoto}>
          <CameraIcon />
        </Tile>
        {withPlan && (
          <Tile label={k.tileWaste} status={busyKey === `${item.id}-WASTE` ? k.uploading : waste.status} tone={waste.tone} disabled={busyKey === `${item.id}-WASTE`} onClick={onWaste}>
            <PlateIcon />
          </Tile>
        )}
      </div>

      {(tempOpen || measuring) && (
        <div className="space-y-2 rounded-xl border border-line bg-page p-3">
          {measuring ? (
            <div className="flex items-center justify-between gap-2" role="status">
              <span className="text-sm text-ink">
                <i aria-hidden="true" className="anim-live mr-2 inline-block h-2 w-2 rounded-full bg-primary" />
                {t.devices.waiting(Math.max(0, Math.ceil((measuringUntil - now) / 1000)))}
              </span>
              <button type="button" className="btn btn-outline btn-sm" onClick={onCancelMeasure}>
                {t.devices.cancel}
              </button>
            </div>
          ) : (
            <>
              <label htmlFor={`${item.id}-temp`} className="block text-sm font-semibold text-ink">
                {n.serve} <span className="font-normal text-muted">· {normText}</span>
              </label>
              <div className="flex gap-2">
                <input
                  id={`${item.id}-temp`}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                  className="field min-h-12 flex-1 text-lg"
                  autoFocus
                />
                <button type="button" onClick={save} disabled={busyKey === `${item.id}-HOT_TEMP`} className="btn btn-primary px-5">
                  {k.tempSave}
                </button>
              </div>
              {hasProbe && (
                <button type="button" onClick={onMeasure} className="btn btn-outline w-full">
                  <ThermometerIcon />
                  {t.devices.measure}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {verdict && (
        <p className={`text-sm font-semibold ${lastHot?.isViolation ? "text-bad-700" : "text-ok-700"}`} aria-live="polite">
          {verdict}
          {lastHot?.source === "DEVICE" && <span className="font-normal text-muted"> · {t.devices.fromDevice}</span>}
        </p>
      )}
      {lastPhoto?.aiStatus === "FLAGGED" && lastPhoto.aiIssues.length > 0 && (
        <p className="text-xs font-medium text-warn-700">{issueLabels(lastPhoto.aiIssues, t.photoIssues).join(" · ")}</p>
      )}

      {(item.planItem || item.batch || item.offPlanReason) && (
        <details className="text-xs text-ink-2">
          <summary className="cursor-pointer text-muted hover:text-ink">{k.details}</summary>
          <div className="mt-2 space-y-1 rounded-lg bg-page px-3 py-2">
            {item.planItem && (
              <p>
                <span className="font-semibold text-ink">{t.plan.composition}:</span> {item.planItem.composition}
              </p>
            )}
            {item.batch && <p>{k.batch(item.batch.code, item.batch.supplier.name)} · {item.batch.product}</p>}
            {item.offPlanReason && <p className="text-warn-700">{item.offPlanReason}</p>}
          </div>
        </details>
      )}
    </article>
  );
}
