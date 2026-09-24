"use client";

import { useState } from "react";
import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import { compressImageToDataUrl } from "@/lib/image";
import { PRESCRIPTION_STATUS_LABEL } from "@/lib/risk/labels";
import { fullDate } from "@/lib/format";

type KitchenLog = {
  id: string;
  type: "PHOTO" | "FRIDGE_TEMP" | "HOT_TEMP";
  valueC: number | null;
  photoUrl: string | null;
  isViolation: boolean;
  createdAt: string;
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

async function uploadPhoto(dataUrl: string) {
  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, filename: "portion.jpg" }),
  });
  const data = await res.json();
  return data.url as string;
}

type TodayResponse = { menuItems?: MenuItem[]; prescriptions?: Prescription[]; suppliers?: Supplier[] };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function KitchenPage() {
  // СЭС бұғаттаған тағамдар мен жаңа нұсқамалар асханаға да көрінуі үшін мезгіл-мезгіл жаңарады.
  const { data, mutate: load } = useSWR<TodayResponse>("/api/kitchen/today", fetcher, { refreshInterval: 15000 });
  const menuItems = data?.menuItems ?? [];
  const prescriptions = data?.prescriptions ?? [];
  const suppliers = data?.suppliers ?? [];
  const loading = !data;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tempInputs, setTempInputs] = useState<Record<string, string>>({});
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [showMenuForm, setShowMenuForm] = useState(false);

  async function handlePhoto(menuItemId: string, file: File) {
    setBusyId(menuItemId);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      const url = await uploadPhoto(dataUrl);
      await fetch("/api/kitchen/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId, type: "PHOTO", photoUrl: url }),
      });
      await load();
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

  async function handlePrescriptionSubmit(prescriptionId: string, file: File) {
    setBusyId(prescriptionId);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      const url = await uploadPhoto(dataUrl);
      await fetch(`/api/prescriptions/${prescriptionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", evidencePhotoUrl: url }),
      });
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
    return <div className="p-6 text-center text-muted">Жүктелуде...</div>;
  }

  return (
    <main className="min-h-screen pb-24">
      <AppHeader subtitle="Асхана журналы" roleLabel="Асхана қызметкері" />

      <div className="p-4 space-y-4">
        {prescriptions.length > 0 && (
          <section className="bg-warn-50 border border-warn-500 rounded-lg p-4 space-y-3">
            <h2 className="font-bold text-warn-700">Ашық нұсқамалар</h2>
            {prescriptions.map((p) => (
              <div key={p.id} className="card p-3 space-y-2">
                <p className="text-sm text-ink">{p.text}</p>
                <p className="text-xs text-muted">
                  Мерзімі: {fullDate(p.dueAt)} · Статус: {PRESCRIPTION_STATUS_LABEL[p.status] ?? p.status}
                </p>
                {p.status === "OPEN" && (
                  <label className="inline-block w-full text-center bg-warn-600 text-white font-semibold rounded-lg py-2 active:opacity-80">
                    {busyId === p.id ? "Жүктелуде..." : "Орындалды (фото-дәлел)"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePrescriptionSubmit(p.id, f);
                      }}
                    />
                  </label>
                )}
              </div>
            ))}
          </section>
        )}

        <section className="flex gap-2">
          <button
            onClick={() => setShowMenuForm((v) => !v)}
            className="flex-1 bg-navy-700 text-white font-semibold rounded-xl py-3 text-sm"
          >
            + Мәзірге тағам қосу
          </button>
          <button
            onClick={() => setShowBatchForm((v) => !v)}
            className="flex-1 bg-navy-600 text-white font-semibold rounded-xl py-3 text-sm"
          >
            + Партия қабылдау
          </button>
        </section>

        {showMenuForm && (
          <form
            action={handleAddMenu}
            className="card p-4 space-y-3 border border-line"
          >
            <input name="name" required placeholder="Тағам атауы" className="field" />
            <input name="portion" type="number" placeholder="Порция (г)" className="field" />
            <button type="submit" className="w-full bg-navy-700 text-white rounded-lg py-2 font-semibold">
              Қосу
            </button>
          </form>
        )}

        {showBatchForm && (
          <form
            action={handleAddBatch}
            className="card p-4 space-y-3 border border-line"
          >
            <select name="supplierId" required className="field">
              <option value="">Жеткізушіні таңдаңыз</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id} disabled={s.blocked}>
                  {s.name} {s.blocked ? "(бұғатталған)" : ""}
                </option>
              ))}
            </select>
            <input name="batchCode" required placeholder="Партия коды" className="field" />
            <input name="product" required placeholder="Өнім" className="field" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted">Өндірілген күні</label>
                <input name="producedAt" type="date" required className="field" />
              </div>
              <div>
                <label className="text-xs text-muted">Жарамдылық мерзімі</label>
                <input name="expiresAt" type="date" required className="field" />
              </div>
            </div>
            <button type="submit" className="w-full bg-navy-600 text-white rounded-lg py-2 font-semibold">
              Қабылдау
            </button>
          </form>
        )}

        <section className="space-y-3">
          <h2 className="font-bold text-ink">Бүгінгі мәзір</h2>
          {menuItems.length === 0 && (
            <p className="text-sm text-muted">Бүгін мәзір енгізілмеген. Жоғарыдан қосыңыз.</p>
          )}
          {menuItems.map((item) => {
            const lastPhoto = item.logs.find((l) => l.type === "PHOTO");
            const fridgeKey = `${item.id}-FRIDGE_TEMP`;
            const hotKey = `${item.id}-HOT_TEMP`;
            return (
              <div
                key={item.id}
                className={`card p-4 space-y-3 border ${item.blocked ? "border-bad-300" : "border-line"}`}
              >
                {item.blocked && (
                  <p className="text-sm font-bold text-bad-600 bg-bad-50 rounded-lg px-3 py-2">
                    Уақытша берілмесін — СЭС шешімін күтуде
                  </p>
                )}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink">{item.name}</p>
                    {item.standardPortionG && <p className="text-xs text-muted">Порция: {item.standardPortionG} г</p>}
                    {item.batch && (
                      <p className="text-xs text-muted">
                        Партия: {item.batch.code} · {item.batch.supplier.name}
                      </p>
                    )}
                  </div>
                  {lastPhoto?.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={lastPhoto.photoUrl} alt="Порция" className="w-16 h-16 object-cover rounded-lg" />
                  )}
                </div>

                <label className="block w-full text-center bg-navy-700 text-white font-semibold rounded-lg py-2.5 active:opacity-80">
                  {busyId === item.id ? "Жүктелуде..." : lastPhoto ? "Фотоны жаңарту" : "Порция фотосы"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePhoto(item.id, f);
                    }}
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted">Тоңазытқыш, °C</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={tempInputs[fridgeKey] ?? ""}
                        onChange={(e) => setTempInputs((s) => ({ ...s, [fridgeKey]: e.target.value }))}
                        className="w-full border border-line-strong rounded-lg px-2 py-2 text-sm"
                      />
                      <button
                        onClick={() => handleTemp(item.id, "FRIDGE_TEMP")}
                        disabled={busyId === fridgeKey}
                        className="bg-navy-700 text-white rounded-lg px-3 text-sm font-semibold"
                      >
                        ОК
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted">Ыстық тағам, °C</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={tempInputs[hotKey] ?? ""}
                        onChange={(e) => setTempInputs((s) => ({ ...s, [hotKey]: e.target.value }))}
                        className="w-full border border-line-strong rounded-lg px-2 py-2 text-sm"
                      />
                      <button
                        onClick={() => handleTemp(item.id, "HOT_TEMP")}
                        disabled={busyId === hotKey}
                        className="bg-navy-700 text-white rounded-lg px-3 text-sm font-semibold"
                      >
                        ОК
                      </button>
                    </div>
                  </div>
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
                        {l.type === "FRIDGE_TEMP" ? "Тоңазытқыш" : "Ыстық"}: {l.valueC}°C
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
