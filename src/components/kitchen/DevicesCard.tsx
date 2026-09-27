"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import type { Device } from "./types";

const ONLINE_MS = 10 * 60_000;

/** Асхананың құрылғылары: күйі мен соңғы өлшемі, жаңа құрылғы (кілт бір рет көрсетіледі), өшіру. */
export function DevicesCard({ devices, onChange }: { devices: Device[]; onChange: () => void }) {
  const t = useT();
  const d = t.devices;
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ key: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  async function create(form: FormData) {
    const res = await fetch("/api/kitchen/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: form.get("kind"), label: form.get("label") }),
    });
    const data = await res.json();
    if (!res.ok) return;
    setCreated({ key: data.key, label: data.device.label });
    setCopied(false);
    setOpen(false);
    onChange();
  }

  async function revoke(device: Device) {
    if (!window.confirm(d.confirmRevoke(device.label))) return;
    await fetch(`/api/kitchen/devices/${device.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <section className="card space-y-3 p-4" aria-labelledby="devices-title">
      <h2 id="devices-title" className="font-bold text-ink">
        {d.listTitle}
      </h2>
      <p className="text-xs text-muted">{d.hint}</p>

      {devices.length === 0 && <p className="text-sm text-muted">{d.empty}</p>}
      <ul className="space-y-2">
        {devices.map((device) => {
          const seen = device.lastSeenAt ? Math.max(0, Math.round((now - Date.parse(device.lastSeenAt)) / 1000)) : null;
          const online = seen !== null && seen * 1000 < ONLINE_MS;
          return (
            <li key={device.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {device.label} <span className="font-normal text-muted">· {d.kinds[device.kind]} · …{device.keyHint}</span>
                </p>
                <p className="text-xs text-muted">
                  <i aria-hidden="true" className={`mr-1 inline-block h-2 w-2 rounded-full ${online ? "bg-ok-500" : "bg-muted"}`} />
                  {online ? d.online : d.offline}
                  {device.lastValue !== null && seen !== null ? ` · ${device.lastValue} °C · ${d.ago(seen)}` : seen === null ? ` · ${d.never}` : ""}
                </p>
              </div>
              <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={() => revoke(device)}>
                {d.revoke}
              </button>
            </li>
          );
        })}
      </ul>

      {created && (
        <div className="space-y-2 rounded-lg border border-primary bg-primary-soft p-3" role="status">
          <p className="text-sm font-semibold text-ink">
            {d.keyTitle}: {created.label}
          </p>
          <p className="text-xs text-ink-2">{d.keyOnce}</p>
          <code className="block break-all rounded bg-page px-2 py-1.5 font-mono text-xs text-ink">{created.key}</code>
          <p className="text-xs text-muted">
            {d.endpoint}: <span className="font-mono">{origin}/api/device/readings</span>
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigator.clipboard?.writeText(created.key).then(() => setCopied(true))}
          >
            {copied ? d.copied : d.copy}
          </button>
        </div>
      )}

      {open ? (
        <form action={create} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <select name="kind" className="field" aria-label={d.kind} defaultValue="PROBE">
            <option value="PROBE">{d.kinds.PROBE}</option>
            <option value="FRIDGE">{d.kinds.FRIDGE}</option>
          </select>
          <input name="label" required maxLength={60} placeholder={d.labelPlaceholder} aria-label={d.label} className="field" />
          <button type="submit" className="btn btn-primary">
            {d.create}
          </button>
        </form>
      ) : (
        <button type="button" className="btn btn-outline w-full" onClick={() => setOpen(true)}>
          {d.add}
        </button>
      )}
    </section>
  );
}
