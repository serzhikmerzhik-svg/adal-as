"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import { CameraCapture, type CaptureMeta, type CapturePurpose } from "@/components/CameraCapture";
import { AddDishForm } from "@/components/kitchen/AddDishForm";
import { DishCard } from "@/components/kitchen/DishCard";
import { KitchenTabs } from "@/components/kitchen/KitchenTabs";
import { StaffCard } from "@/components/kitchen/StaffCard";
import type { MenuItem, TodayResponse } from "@/components/kitchen/types";
import { fullDate, shortName } from "@/lib/format";
import { hasPlan } from "@/lib/plan";
import { serveNorm } from "@/lib/temperature";
import { useLocale, useT } from "@/i18n/client";

// Асхана журналы: қарапайым қызметкерге арналған — жоғарыда бүгінгі жұмыстың қадамдары мен прогресі,
// әр тағамда үш үлкен әрекет (температура, порция фотосы, қалдық). Құрылғылар мен QR-тұғыр — бөлек қойындыларда.

/** Камера ашылған мақсат: порция, қайтарылған табақтар, нұсқаманың дәлелі не қызметкер формасы. */
type CameraTarget =
  | { kind: "portion"; menuItemId: string; name: string }
  | { kind: "waste"; menuItemId: string; name: string }
  | { kind: "proof"; prescriptionId: string }
  | { kind: "staff"; staffId: string; label: string };

const PURPOSE: Record<CameraTarget["kind"], CapturePurpose> = { portion: "PORTION", waste: "WASTE", proof: "PROOF", staff: "STAFF" };

/** Термометр «Өлшеу» күтіп тұрған тағам: осыған дейінгі соңғы құрылғы өлшемі (жаңасын тану үшін). */
type Measuring = { menuItemId: string; until: number; baselineLogId: string | null };

async function uploadPhoto(dataUrl: string, filename: string) {
  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, filename }),
  });
  if (!res.ok) throw new Error("upload");
  const data = await res.json();
  return data.url as string;
}

const postJson = (url: string, body: unknown, method = "POST") =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const lastDeviceHot = (item?: MenuItem) => item?.logs.find((l) => l.type === "HOT_TEMP" && l.source === "DEVICE");

// ИИ тексеруі не термометр күтілгенде жиірек сұраймыз, нәтиже асханаға бірден көрінсін.
const hasPending = (data?: TodayResponse) =>
  !!data?.menuItems?.some((m) => m.logs.some((l) => (l.type === "PHOTO" || l.type === "WASTE") && l.aiStatus === "PENDING")) ||
  !!data?.staff?.some((s) => s.checks[0]?.aiStatus === "PENDING");

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Кері санақ үшін қазіргі уақыт (оқиға өңдеушілерінде шақырылады). */
const clock = () => Date.now();

/** Бүгінгі жұмыстың бір қадамы: атауы және орындалғаны (мыс. «Температура 1/3»). */
function Step({ label, done, total }: { label: string; done: number; total: number }) {
  const complete = total > 0 && done >= total;
  return (
    <li className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${complete ? "border-ok-500/60" : "border-line"}`}>
      <span className="text-ink">{label}</span>
      <span className={`font-mono font-semibold tabular-nums ${complete ? "text-ok-700" : done > 0 ? "text-warn-700" : "text-muted"}`}>
        {complete ? "✓" : `${done}/${total}`}
      </span>
    </li>
  );
}

export default function KitchenPage() {
  const t = useT();
  const locale = useLocale();
  const k = t.kitchen;
  const [measuring, setMeasuring] = useState<Measuring | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  /** Беру температурасының нәтижесі: норма не «суып қалған». */
  const tempNotice = (item: MenuItem, value: number, violation: boolean) => {
    const norm = serveNorm(item.category);
    const verdict = !violation ? t.norms.ok(value) : norm.min !== undefined ? t.norms.tooCold(value, norm.min) : t.norms.tooWarm(value, norm.max ?? 0);
    return `${item.name}: ${verdict}`;
  };

  // СЭС бұғаттаған тағамдар мен жаңа нұсқамалар асханаға да көрінуі үшін мезгіл-мезгіл жаңарады.
  const { data, mutate: load } = useSWR<TodayResponse>("/api/kitchen/today", fetcher, {
    refreshInterval: (latest) => (measuring || hasPending(latest) ? 1500 : 15000),
    onSuccess: (latest) => {
      if (!measuring) return;
      const item = latest.menuItems?.find((m) => m.id === measuring.menuItemId);
      const log = lastDeviceHot(item);
      if (item && log && log.id !== measuring.baselineLogId && log.valueC !== null) {
        setMeasuring(null);
        setNotice(tempNotice(item, log.valueC, log.isViolation));
      } else if (Date.now() > measuring.until) {
        setMeasuring(null);
      }
    },
  });
  const menuItems = data?.menuItems ?? [];
  const prescriptions = data?.prescriptions ?? [];
  const suppliers = data?.suppliers ?? [];
  const staff = data?.staff ?? [];
  const devices = data?.devices ?? [];
  const fridgeLogs = data?.fridgeLogs ?? [];
  const withPlan = !!data?.school && hasPlan(data.school.kind);
  const hasProbe = devices.some((d) => d.kind === "PROBE");
  const fridgeSensor = devices.find((d) => d.kind === "FRIDGE" && d.lastValue !== null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [fridgeValue, setFridgeValue] = useState("");
  const [camera, setCamera] = useState<CameraTarget | null>(null);

  useEffect(() => {
    if (!measuring) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [measuring]);

  // Сурет пен бір реттік токен бірге жіберіледі: сервер токенді өтейді, онсыз фото қабылданбайды.
  async function handleCapture(dataUrl: string, meta: CaptureMeta) {
    if (!camera) return;
    const target = camera;
    const key =
      target.kind === "portion"
        ? target.menuItemId
        : target.kind === "waste"
          ? `${target.menuItemId}-WASTE`
          : target.kind === "proof"
            ? target.prescriptionId
            : target.staffId;
    setCamera(null);
    setBusyKey(key);
    try {
      let res: Response;
      let done: string;
      if (target.kind === "staff") {
        // Қызметкердің фотосы файл қоймасына жүктелмейді: тек ИИ тексеруіне жіберіледі.
        res = await postJson(`/api/kitchen/staff/${target.staffId}/check`, { photo: dataUrl, captureToken: meta.captureToken });
        done = t.staff.sent;
      } else {
        const url = await uploadPhoto(dataUrl, `${target.kind}.jpg`);
        if (target.kind === "proof") {
          res = await postJson(`/api/prescriptions/${target.prescriptionId}`, { action: "submit", evidencePhotoUrl: url, captureToken: meta.captureToken }, "PATCH");
          done = k.proofSent;
        } else if (target.kind === "waste") {
          res = await postJson("/api/kitchen/logs", { menuItemId: target.menuItemId, type: "WASTE", photoUrl: url, captureToken: meta.captureToken });
          done = t.waste.sent;
        } else {
          res = await postJson("/api/kitchen/logs", { menuItemId: target.menuItemId, type: "PHOTO", photoUrl: url, ...meta });
          done = k.sent;
        }
      }
      const body = await res.json().catch(() => ({}));
      setNotice(res.ok ? done : (body.error ?? k.sendFailed));
      await load();
    } catch {
      setNotice(k.sendOffline);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleHotTemp(item: MenuItem, value: number) {
    setBusyKey(`${item.id}-HOT_TEMP`);
    try {
      const res = await postJson("/api/kitchen/logs", { menuItemId: item.id, type: "HOT_TEMP", valueC: value });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setNotice(tempNotice(item, value, body.log?.isViolation));
      await load();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleFridge() {
    const value = Number(fridgeValue.replace(",", "."));
    if (fridgeValue.trim() === "" || Number.isNaN(value)) return;
    setBusyKey("fridge");
    try {
      await postJson("/api/kitchen/logs", { type: "FRIDGE_TEMP", valueC: value });
      setFridgeValue("");
      await load();
    } finally {
      setBusyKey(null);
    }
  }

  /** Термометр осы тағамға «дайын» болады; өлшем келгенде журналға өзі жазылады. */
  async function handleMeasure(item: MenuItem) {
    const res = await postJson("/api/kitchen/measure", { menuItemId: item.id });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(body.error ?? t.common.error);
      return;
    }
    if (body.assigned) {
      setNotice(tempNotice(item, body.assigned.valueC, body.assigned.violation));
      await load();
      return;
    }
    setNow(clock());
    setMeasuring({ menuItemId: item.id, until: Date.parse(body.armedUntil), baselineLogId: lastDeviceHot(item)?.id ?? null });
  }

  async function cancelMeasure() {
    setMeasuring(null);
    await fetch("/api/kitchen/measure", { method: "DELETE" });
  }

  async function fillFromPlan() {
    setBusyKey("fill");
    try {
      await fetch("/api/kitchen/menu/fill", { method: "POST" });
      await load();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAddBatch(form: FormData) {
    await postJson("/api/kitchen/batches", {
      supplierId: form.get("supplierId"),
      batchCode: form.get("batchCode"),
      product: form.get("product"),
      producedAt: form.get("producedAt"),
      expiresAt: form.get("expiresAt"),
    });
    setShowBatchForm(false);
    await load();
  }

  if (!data) {
    return <div className="p-6 text-center text-muted">{t.common.loading}</div>;
  }

  const cameraTitle = !camera
    ? ""
    : camera.kind === "portion"
      ? camera.name
      : camera.kind === "waste"
        ? t.waste.cameraTitle(camera.name)
        : camera.kind === "staff"
          ? t.staff.cameraTitle(camera.label)
          : t.camera.proofTitle;

  // Бүгінгі жұмыстың қадамдары: не жасалды, не қалды.
  const dishCount = menuItems.length;
  const has = (type: string) => menuItems.filter((m) => m.logs.some((l) => l.type === type)).length;
  const steps = [
    ...(staff.length ? [{ label: k.steps.staff, done: staff.filter((s) => s.checks[0]?.aiStatus === "OK").length, total: staff.length }] : []),
    { label: k.steps.temp, done: has("HOT_TEMP"), total: dishCount },
    { label: k.steps.photo, done: has("PHOTO"), total: dishCount },
    ...(withPlan ? [{ label: k.steps.waste, done: has("WASTE"), total: dishCount }] : []),
    { label: k.steps.fridge, done: fridgeLogs.length > 0 || fridgeSensor ? 1 : 0, total: 1 },
  ];
  const doneTotal = steps.reduce((sum, s) => sum + Math.min(s.done, s.total), 0);
  const allTotal = steps.reduce((sum, s) => sum + s.total, 0);
  const lastFridge = fridgeLogs[0];

  return (
    <main className="min-h-screen pb-24">
      <AppHeader
        subtitle={data.school ? `${k.subtitle} · ${shortName(data.school.name, data.school.kind, locale)}` : k.subtitle}
        roleLabel={t.roles.kitchen}
      />

      {camera && (
        <CameraCapture
          title={cameraTitle}
          purpose={PURPOSE[camera.kind]}
          targetId={camera.kind === "proof" ? camera.prescriptionId : camera.kind === "staff" ? camera.staffId : camera.menuItemId}
          onCapture={handleCapture}
          onClose={() => setCamera(null)}
        />
      )}

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <KitchenTabs />

        <p aria-live="polite" className={notice ? "anim-slide-in rounded-lg bg-primary-soft px-3 py-2 text-sm text-ink" : "sr-only"}>
          {notice}
        </p>

        {prescriptions.length > 0 && (
          <section className="space-y-3 rounded-xl border border-warn-500 bg-warn-50 p-4">
            <h2 className="font-bold text-warn-700">{k.urgent}</h2>
            {prescriptions.map((p) => (
              <div key={p.id} className="card space-y-2 p-3">
                <p className="text-sm text-ink">{p.text}</p>
                <p className="text-xs text-muted">
                  {k.due(fullDate(p.dueAt))} · {k.status(t.prescriptionStatus[p.status] ?? p.status)}
                </p>
                {p.status === "OPEN" && (
                  <button
                    type="button"
                    className="btn btn-warn w-full"
                    disabled={busyKey === p.id}
                    onClick={() => setCamera({ kind: "proof", prescriptionId: p.id })}
                  >
                    {busyKey === p.id ? k.uploading : k.doneWithPhoto}
                  </button>
                )}
              </div>
            ))}
          </section>
        )}

        <section className="card space-y-3 p-4" aria-labelledby="today-work">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="today-work" className="text-lg font-bold text-ink">
              {k.todayWork}
            </h2>
            <span className="text-sm font-semibold text-ink-2">{k.progress(doneTotal, allTotal)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-page" role="progressbar" aria-valuemin={0} aria-valuemax={allTotal} aria-valuenow={doneTotal}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${allTotal ? (doneTotal / allTotal) * 100 : 0}%` }} />
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <Step key={s.label} label={s.label} done={s.done} total={s.total} />
            ))}
          </ul>
        </section>

        {staff.length > 0 && (
          <StaffCard staff={staff} busyId={busyKey} onCheck={(member) => setCamera({ kind: "staff", staffId: member.id, label: member.label })} />
        )}

        <section className="space-y-3" aria-labelledby="menu-title">
          <div>
            <h2 id="menu-title" className="text-lg font-bold text-ink">
              {k.todayMenu}
            </h2>
            {withPlan && data.planDay ? <p className="text-xs text-muted">{t.plan.today(data.planDay)}</p> : null}
          </div>

          {menuItems.length === 0 && (
            <div className="card space-y-3 p-4 text-center">
              <p className="text-sm text-muted">{withPlan ? k.fillHint : k.noMenu}</p>
              {withPlan && (
                <button type="button" className="btn btn-primary w-full py-3" disabled={busyKey === "fill"} onClick={fillFromPlan}>
                  {k.fillFromPlan}
                </button>
              )}
            </div>
          )}

          {menuItems.map((item) => (
            <DishCard
              key={item.id}
              item={item}
              withPlan={withPlan}
              hasProbe={hasProbe}
              busyKey={busyKey}
              measuringUntil={measuring?.menuItemId === item.id ? measuring.until : null}
              now={now}
              onPhoto={() => setCamera({ kind: "portion", menuItemId: item.id, name: item.name })}
              onWaste={() => setCamera({ kind: "waste", menuItemId: item.id, name: item.name })}
              onMeasure={() => handleMeasure(item)}
              onCancelMeasure={cancelMeasure}
              onTemp={(value) => handleHotTemp(item, value)}
            />
          ))}

          <button type="button" onClick={() => setShowMenuForm((v) => !v)} className="btn btn-outline w-full">
            {withPlan ? k.addOffPlan : k.addDish}
          </button>
          {showMenuForm && (
            <AddDishForm
              withPlan={withPlan}
              plan={data.plan ?? []}
              planDay={data.planDay ?? null}
              takenPlanIds={menuItems.map((m) => m.planItemId).filter((id): id is string => !!id)}
              batches={data.batches ?? []}
              onDone={async (error) => {
                if (error) {
                  setNotice(error);
                  return;
                }
                setShowMenuForm(false);
                await load();
              }}
            />
          )}
        </section>

        <section className="card space-y-3 p-4" aria-labelledby="fridge-title">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="fridge-title" className="font-bold text-ink">
              {k.fridgeTitle}
            </h2>
            <span className="text-xs text-muted">{k.fridgeHint}</span>
          </div>
          {fridgeSensor && fridgeSensor.lastValue !== null && fridgeSensor.lastSeenAt && (
            <p className="text-sm font-medium text-ink">
              {k.fridgeSensor(fridgeSensor.lastValue, t.devices.ago(Math.max(0, Math.round((now - Date.parse(fridgeSensor.lastSeenAt)) / 1000))))}
            </p>
          )}
          {lastFridge?.valueC != null && (
            <p className={`text-sm font-semibold ${lastFridge.isViolation ? "text-bad-700" : "text-ok-700"}`}>
              {k.fridgeToday(lastFridge.valueC)} {lastFridge.isViolation ? "!" : "✓"}
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={fridgeValue}
              onChange={(e) => setFridgeValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFridge()}
              aria-label={k.fridgeTitle}
              className="field min-h-12 flex-1 text-lg"
            />
            <button type="button" onClick={handleFridge} disabled={busyKey === "fridge"} className="btn btn-primary px-5">
              {k.tempSave}
            </button>
          </div>
        </section>

        <section className="card space-y-3 p-4" aria-labelledby="batches-title">
          <h2 id="batches-title" className="font-bold text-ink">
            {k.batchesTitle}
          </h2>
          <p className="text-xs text-muted">{k.batchesHint}</p>
          <button type="button" onClick={() => setShowBatchForm((v) => !v)} className="btn btn-outline w-full">
            {k.acceptBatch}
          </button>
          {showBatchForm && (
            <form action={handleAddBatch} className="space-y-3">
              <select name="supplierId" required className="field" aria-label={k.pickSupplier}>
                <option value="">{k.pickSupplier}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.blocked}>
                    {s.name} {s.blocked ? k.blockedSuffix : ""}
                  </option>
                ))}
              </select>
              <input name="batchCode" required placeholder={k.batchCode} aria-label={k.batchCode} className="field" />
              <input name="product" required placeholder={k.product} aria-label={k.product} className="field" />
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-muted">{k.producedAt}</span>
                  <input name="producedAt" type="date" required className="field" />
                </label>
                <label className="block">
                  <span className="text-xs text-muted">{k.expiresAt}</span>
                  <input name="expiresAt" type="date" required className="field" />
                </label>
              </div>
              <button type="submit" className="btn btn-primary w-full">
                {k.accept}
              </button>
            </form>
          )}
          {(data.batches ?? []).length > 0 && (
            <ul className="space-y-1 text-xs text-muted">
              {(data.batches ?? []).slice(0, 6).map((b) => (
                <li key={b.id}>
                  {b.code} · {b.product} · {b.supplier.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
