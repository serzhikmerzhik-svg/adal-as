"use client";

import { useState } from "react";
import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import Link from "next/link";
import { CameraCapture, type CaptureMeta } from "@/components/CameraCapture";
import { PHOTO_STATUS_CLASS } from "@/components/ses/PhotoFeedCard";
import type { PhotoStatus } from "@/components/ses/types";
import { issueLabels } from "@/lib/photo/verdict";
import { fullDate, shortName } from "@/lib/format";
import { useLocale, useT } from "@/i18n/client";

type KitchenLog = {
  id: string;
  type: "PHOTO" | "FRIDGE_TEMP" | "HOT_TEMP";
  valueC: number | null;
  photoUrl: string | null;
  isViolation: boolean;
  createdAt: string;
  aiStatus: PhotoStatus | null;
  aiIssues: string[];
  aiPortionPct: number | null;
  aiSummary: string | null;
};

type MenuItem = {
  id: string;
  name: string;
  standardPortionG: number | null;
  blocked: boolean;
  batch: { code: string; supplier: { name: string; blocked: boolean } } | null;
  logs: KitchenLog[];
};

type Prescription = {
  id: string;
  text: string;
  dueAt: string;
  status: string;
};

type Supplier = { id: string; name: string; blocked: boolean };

/** Камера ашылған мақсат: мәзірдегі тағамның порциясы немесе нұсқаманың орындалғаны. */
type CameraTarget = { kind: "portion"; menuItemId: string; name: string } | { kind: "proof"; prescriptionId: string };

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

type TodayResponse = {
  school?: { name: string; kind: string };
  menuItems?: MenuItem[];
  prescriptions?: Prescription[];
  suppliers?: Supplier[];
};

// ИИ тексеруі жүріп жатқанда жиірек сұраймыз, нәтиже асханаға бірден көрінсін.
const hasPendingPhoto = (data?: TodayResponse) =>
  !!data?.menuItems?.some((m) => m.logs.some((l) => l.type === "PHOTO" && l.aiStatus === "PENDING"));

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function KitchenPage() {
  const t = useT();
  const locale = useLocale();
  const k = t.kitchen;
  // СЭС бұғаттаған тағамдар мен жаңа нұсқамалар асханаға да көрінуі үшін мезгіл-мезгіл жаңарады.
  const { data, mutate: load } = useSWR<TodayResponse>("/api/kitchen/today", fetcher, {
    refreshInterval: (latest) => (hasPendingPhoto(latest) ? 2500 : 15000),
  });
  const menuItems = data?.menuItems ?? [];
  const prescriptions = data?.prescriptions ?? [];
  const suppliers = data?.suppliers ?? [];
  const loading = !data;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tempInputs, setTempInputs] = useState<Record<string, string>>({});
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [camera, setCamera] = useState<CameraTarget | null>(null);

  // Сурет пен бір реттік токен бірге жіберіледі: сервер токенді өтейді, онсыз фото қабылданбайды.
  async function handleCapture(dataUrl: string, meta: CaptureMeta) {
    if (!camera) return;
    const target = camera;
    const id = target.kind === "portion" ? target.menuItemId : target.prescriptionId;
    setCamera(null);
    setBusyId(id);
    try {
      const url = await uploadPhoto(dataUrl, target.kind === "portion" ? "portion.jpg" : "proof.jpg");
      const res =
        target.kind === "portion"
          ? await fetch("/api/kitchen/logs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ menuItemId: target.menuItemId, type: "PHOTO", photoUrl: url, ...meta }),
            })
          : await fetch(`/api/prescriptions/${target.prescriptionId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "submit", evidencePhotoUrl: url, captureToken: meta.captureToken }),
            });
      const body = await res.json().catch(() => ({}));
      setNotice(res.ok ? (target.kind === "portion" ? k.sent : k.proofSent) : (body.error ?? k.sendFailed));
      await load();
    } catch {
      setNotice(k.sendOffline);
    } finally {
      setBusyId(null);
    }
  }

  async function handleTemp(menuItemId: string, type: "FRIDGE_TEMP" | "HOT_TEMP") {
    const key = `${menuItemId}-${type}`;
    const value = Number(tempInputs[key]);
    if (Number.isNaN(value)) return;
    setBusyId(key);
    try {
      await fetch("/api/kitchen/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId, type, valueC: value }),
      });
      setTempInputs((s) => ({ ...s, [key]: "" }));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddBatch(form: FormData) {
    await fetch("/api/kitchen/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId: form.get("supplierId"),
        batchCode: form.get("batchCode"),
        product: form.get("product"),
        producedAt: form.get("producedAt"),
        expiresAt: form.get("expiresAt"),
      }),
    });
    setShowBatchForm(false);
    await load();
  }

  async function handleAddMenu(form: FormData) {
    await fetch("/api/kitchen/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        standardPortionG: form.get("portion") ? Number(form.get("portion")) : undefined,
      }),
    });
    setShowMenuForm(false);
    await load();
  }

  if (loading) {
    return <div className="p-6 text-center text-muted">{t.common.loading}</div>;
  }

  return (
    <main className="min-h-screen pb-24">
      <AppHeader
        subtitle={data?.school ? `${k.subtitle} · ${shortName(data.school.name, data.school.kind, locale)}` : k.subtitle}
        roleLabel={t.roles.kitchen}
      />

      {camera && (
        <CameraCapture
          title={camera.kind === "portion" ? camera.name : t.camera.proofTitle}
          purpose={camera.kind === "portion" ? "PORTION" : "PROOF"}
          targetId={camera.kind === "portion" ? camera.menuItemId : camera.prescriptionId}
          onCapture={handleCapture}
          onClose={() => setCamera(null)}
        />
      )}

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <p aria-live="polite" className={notice ? "anim-slide-in rounded-lg bg-primary-soft px-3 py-2 text-sm text-ink" : "sr-only"}>
          {notice}
        </p>
        {prescriptions.length > 0 && (
          <section className="bg-warn-50 border border-warn-500 rounded-lg p-4 space-y-3">
            <h2 className="font-bold text-warn-700">{k.openPrescriptions}</h2>
            {prescriptions.map((p) => (
              <div key={p.id} className="card p-3 space-y-2">
                <p className="text-sm text-ink">{p.text}</p>
                <p className="text-xs text-muted">
                  {k.due(fullDate(p.dueAt))} · {k.status(t.prescriptionStatus[p.status] ?? p.status)}
                </p>
                {p.status === "OPEN" && (
                  <button
                    type="button"
                    className="btn btn-warn w-full"
                    disabled={busyId === p.id}
                    onClick={() => setCamera({ kind: "proof", prescriptionId: p.id })}
                  >
                    {busyId === p.id ? k.uploading : k.doneWithPhoto}
                  </button>
                )}
              </div>
            ))}
          </section>
        )}

        <section className="flex gap-2">
          <button type="button" onClick={() => setShowMenuForm((v) => !v)} className="btn btn-primary flex-1 py-3">
            {k.addDish}
          </button>
          <button type="button" onClick={() => setShowBatchForm((v) => !v)} className="btn btn-outline flex-1 py-3">
            {k.acceptBatch}
          </button>
        </section>

        {showMenuForm && (
          <form action={handleAddMenu} className="card p-4 space-y-3 border border-line">
            <input name="name" required placeholder={k.dishName} aria-label={k.dishName} className="field" />
            <input name="portion" type="number" inputMode="numeric" placeholder={k.portionG} aria-label={k.portionG} className="field" />
            <button type="submit" className="btn btn-primary w-full">
              {k.add}
            </button>
          </form>
        )}

        {showBatchForm && (
          <form action={handleAddBatch} className="card p-4 space-y-3 border border-line">
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

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-bold text-ink">{k.todayMenu}</h2>
            <Link href="/kitchen/qr" className="text-sm font-medium text-primary hover:underline">
              {t.capture.qrLink}
            </Link>
          </div>
          {menuItems.length === 0 && <p className="text-sm text-muted">{k.noMenu}</p>}
          {menuItems.map((item) => {
            const lastPhoto = item.logs.find((l) => l.type === "PHOTO");
            const fridgeKey = `${item.id}-FRIDGE_TEMP`;
            const hotKey = `${item.id}-HOT_TEMP`;
            return (
              <div key={item.id} className={`card p-4 space-y-3 border ${item.blocked ? "border-bad-300" : "border-line"}`}>
                {item.blocked && <p className="text-sm font-bold text-bad-700 bg-bad-50 rounded-lg px-3 py-2">{k.blocked}</p>}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{item.name}</p>
                    {item.standardPortionG && <p className="text-xs text-muted">{k.portion(item.standardPortionG)}</p>}
                    {item.batch && <p className="text-xs text-muted">{k.batch(item.batch.code, item.batch.supplier.name)}</p>}
                  </div>
                  {lastPhoto?.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={lastPhoto.photoUrl} alt={k.photoAlt} className="w-16 h-16 object-cover rounded-lg" />
                  )}
                </div>

                {/* Фото тек камерадан: файл таңдау жоқ, сондықтан ескі не жүктелген суретті жіберу мүмкін емес. */}
                <button
                  type="button"
                  className="btn btn-primary w-full py-2.5"
                  disabled={busyId === item.id}
                  onClick={() => setCamera({ kind: "portion", menuItemId: item.id, name: item.name })}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                    <path d="M4 8h3l1.5-2h7L17 8h3v11H4Z" />
                    <circle cx="12" cy="13" r="3.2" />
                  </svg>
                  {busyId === item.id ? k.uploading : lastPhoto ? k.photoUpdate : k.photoNew}
                </button>

                <p className="text-xs text-muted">{k.photoHint}</p>

                {lastPhoto?.aiStatus && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 font-bold ${PHOTO_STATUS_CLASS[lastPhoto.aiStatus]}`}>
                      {t.photoStatus[lastPhoto.aiStatus]}
                    </span>
                    {lastPhoto.aiPortionPct !== null && <span className="text-muted">{t.ses.photos.portion(lastPhoto.aiPortionPct)}</span>}
                    {issueLabels(lastPhoto.aiIssues, t.photoIssues).map((label) => (
                      <span key={label} className="font-medium text-warn-700">
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      [fridgeKey, "FRIDGE_TEMP", k.fridge],
                      [hotKey, "HOT_TEMP", k.hot],
                    ] as const
                  ).map(([key, type, label]) => (
                    <div key={key} className="space-y-1">
                      <label htmlFor={key} className="text-xs text-muted">
                        {label}
                      </label>
                      <div className="flex gap-1">
                        <input
                          id={key}
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          value={tempInputs[key] ?? ""}
                          onChange={(e) => setTempInputs((s) => ({ ...s, [key]: e.target.value }))}
                          className="field min-h-11"
                        />
                        <button type="button" onClick={() => handleTemp(item.id, type)} disabled={busyId === key} className="btn btn-primary">
                          {k.ok}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.logs
                    .filter((l) => l.type !== "PHOTO")
                    .slice(0, 4)
                    .map((l) => (
                      <span
                        key={l.id}
                        className={`text-xs rounded-full px-2 py-1 ${l.isViolation ? "bg-bad-100 text-bad-700" : "bg-page text-muted"}`}
                      >
                        {l.type === "FRIDGE_TEMP" ? k.fridgeShort : k.hotShort}: {l.valueC}°C
                      </span>
                    ))}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
