"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { fullDate, hm, hms } from "@/lib/format";
import { useT } from "@/i18n/client";

// Камерадан түсіру экраны: галерея жоқ. Геолокация → серверден бір реттік токен (2 мин) → тікелей камера,
// кадрда QR-тұғырды тану → түсіру (су белгісі: нысан коды, сервер уақыты, токен).

type TokenInfo = {
  token: string;
  expiresAt: string;
  serverTime: string;
  code: string;
  qrPayload: string;
  qrRequired: boolean;
  geofence: { distanceM: number | null; radiusM: number; bypass: boolean };
};
type Phase = "permission" | "locating" | "starting" | "live" | "blocked";
export type CaptureMeta = { captureToken: string; qrCode?: string };

// Бұрын рұқсат берілсе, түсіндірме экранын қайта көрсетпейміз (тек ыңғайлылық үшін).
const GRANTED_KEY = "adal-as-camera-ok";
function wasGranted() {
  try {
    return window.localStorage.getItem(GRANTED_KEY) === "1";
  } catch {
    return false;
  }
}
function rememberGranted() {
  try {
    window.localStorage.setItem(GRANTED_KEY, "1");
  } catch {
    // жеке режимде сақталмайды — келесі жолы түсіндірме қайта шығады
  }
}

function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

function QrIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
      <path d="M14.5 14.5h2.5v2.5M20.5 14.5v1M14.5 20.5h1M18 18h2.5v2.5" />
    </svg>
  );
}

export function CameraCapture({
  title,
  purpose,
  targetId,
  onCapture,
  onClose,
}: {
  title: string;
  purpose: "PORTION" | "PROOF";
  targetId: string;
  onCapture: (dataUrl: string, meta: CaptureMeta) => Promise<void> | void;
  onClose: () => void;
}) {
  const t = useT();
  const c = t.capture;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanRef = useRef<HTMLCanvasElement | null>(null);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [phase, setPhase] = useState<Phase>(() => (wasGranted() ? "locating" : "permission"));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [offset, setOffset] = useState(0); // сервер уақыты − құрылғы уақыты
  const [now, setNow] = useState(() => Date.now());
  const [qrSeenAt, setQrSeenAt] = useState(0);
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  /** Серверден бір реттік токен сұрайды; қате болса (аумақтан тыс т.б.) — хабарламаны қайтарады. */
  const requestToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/kitchen/capture-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, targetId, ...(coordsRef.current ?? {}) }),
      });
      const data = await res.json();
      if (!res.ok) return data.error ?? t.common.error;
      setInfo(data);
      setOffset(Date.parse(data.serverTime) - Date.now());
      return null;
    } catch {
      return t.common.error;
    }
  }, [purpose, targetId, t.common.error]);

  // 1. Геолокация → токен.
  useEffect(() => {
    if (phase !== "locating") return;
    let cancelled = false;
    (async () => {
      coordsRef.current = await getPosition();
      if (cancelled) return;
      const problem = await requestToken();
      if (cancelled) return;
      if (problem) {
        setError(problem);
        setPhase("blocked");
      } else {
        setPhase("starting");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, requestToken]);

  // 2. Камера.
  useEffect(() => {
    if (phase !== "starting") return;
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t.camera.unavailable);
        setPhase("blocked");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        rememberGranted();
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setPhase("live");
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        setError(name === "NotAllowedError" || name === "SecurityError" ? t.camera.denied : name === "NotFoundError" ? t.camera.unavailable : t.camera.error);
        setPhase("blocked");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, t.camera]);

  useEffect(() => stopCamera, [stopCamera]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const remainingMs = info ? Date.parse(info.expiresAt) - (now + offset) : 0;

  // 3. Токен мерзімі біткен сәтте камераны өшірмей жаңа токен аламыз (жаңа токен келгенде таймер қайта қойылады).
  useEffect(() => {
    if (phase !== "live" || !info) return;
    const timer = setTimeout(async () => {
      const problem = await requestToken();
      if (problem) {
        setError(problem);
        setPhase("blocked");
        stopCamera();
      }
    }, Math.max(0, Date.parse(info.expiresAt) - (Date.now() + offset)));
    return () => clearTimeout(timer);
  }, [phase, info, offset, requestToken, stopCamera]);

  // 4. Кадрда QR-тұғырды іздеу (жергілікті, серверге кадр жіберілмейді).
  useEffect(() => {
    if (phase !== "live" || !info?.qrRequired) return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;
      const scale = Math.min(1, 800 / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      const canvas = (scanRef.current ??= document.createElement("canvas"));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
      if (found?.data === info.qrPayload) setQrSeenAt(Date.now());
    }, 350);
    return () => clearInterval(timer);
  }, [phase, info]);

  const qrOk = !!info && (!info.qrRequired || now - qrSeenAt < 2500);
  const canShoot = phase === "live" && !!info && remainingMs > 0 && qrOk && !busy;
  const serverNow = new Date(now + offset);

  async function shoot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !info) return;
    setBusy(true);
    try {
      const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Су белгісі: нысан коды, сервер уақыты, токеннің басы және геолокация.
      const at = new Date(Date.now() + offset);
      const band = Math.round(canvas.height * 0.1);
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(0, canvas.height - band, canvas.width, band);
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 ${Math.round(band * 0.34)}px sans-serif`;
      ctx.fillText(`Adal As · ${info.code} · ${fullDate(at)} ${hms(at)}`, band * 0.3, canvas.height - band * 0.55);
      ctx.font = `${Math.round(band * 0.26)}px monospace`;
      const geo = info.geofence.distanceM !== null ? ` · GEO ${info.geofence.distanceM} m` : "";
      ctx.fillText(`#${info.token.slice(0, 8)}${geo}`, band * 0.3, canvas.height - band * 0.18);

      let quality = 0.8;
      let dataUrl = canvas.toDataURL("image/jpeg", quality);
      while (dataUrl.length / 1024 > 220 && quality > 0.3) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }
      stopCamera();
      await onCapture(dataUrl, { captureToken: info.token, qrCode: info.qrRequired ? info.qrPayload : undefined });
    } finally {
      setBusy(false);
    }
  }

  const statusText = phase === "locating" ? (info ? c.gettingToken : c.locating) : phase === "starting" ? t.camera.starting : phase === "blocked" ? error : null;
  const geoValue = !info ? "—" : info.geofence.bypass ? c.geoBypass : info.geofence.distanceM !== null ? c.geoOk(info.geofence.distanceM) : "—";
  const qrValue = !info ? "—" : !info.qrRequired ? c.qrNotNeeded : qrOk ? c.qrOk(info.code) : c.qrWaiting;
  const checks: [string, string, boolean][] = [
    [c.checkGeo, geoValue, !!info],
    [c.checkQr, qrValue, !!info && qrOk],
    [c.checkToken, info ? (remainingMs > 0 ? c.tokenLeft(mmss(remainingMs)) : c.tokenRenewing) : "—", !!info && remainingMs > 0],
    [c.checkTime, info ? c.serverTime(hm(serverNow)) : "—", !!info],
  ];

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="capture-title" className="fixed inset-0 z-[70] overflow-y-auto bg-page">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="shrink-0 rounded-md px-1 py-1 text-sm text-ink-2 hover:text-ink">
            ← {t.common.back}
          </button>
          <p id="capture-title" className="truncate font-semibold text-ink">
            {title}
          </p>
          <span className="shrink-0 rounded-md bg-primary-soft px-2 py-1 font-mono text-sm tabular-nums text-primary" aria-label={c.checkToken}>
            {info ? mmss(remainingMs) : "--:--"}
          </span>
        </div>

        {phase === "permission" ? (
          <div className="card space-y-4 p-5">
            <span className="inline-flex rounded-xl bg-primary-soft p-2.5 text-primary">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                <path d="M4 8h3l1.5-2h7L17 8h3v11H4Z" />
                <circle cx="12" cy="13" r="3.2" />
              </svg>
            </span>
            <p className="text-lg font-semibold text-ink">{t.camera.permissionTitle}</p>
            <p className="text-sm text-ink-2">{c.permissionText}</p>
            <button type="button" className="btn btn-primary w-full" onClick={() => setPhase("locating")} autoFocus>
              {c.permission}
            </button>
          </div>
        ) : (
          <>
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-black">
              <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-page/80 px-2.5 py-1 text-xs font-semibold text-ink">
                <i aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${phase === "live" ? "anim-live bg-bad-600" : "bg-muted"}`} />
                {c.live}
              </span>
              {[
                "left-4 top-12 border-l-[3px] border-t-[3px] rounded-tl-lg",
                "right-4 top-12 border-r-[3px] border-t-[3px] rounded-tr-lg",
                "left-4 bottom-4 border-l-[3px] border-b-[3px] rounded-bl-lg",
                "right-4 bottom-4 border-r-[3px] border-b-[3px] rounded-br-lg",
              ].map((cls) => (
                <span key={cls} aria-hidden="true" className={`pointer-events-none absolute h-10 w-10 border-white/90 ${cls}`} />
              ))}
              {purpose === "PORTION" && (
                <>
                  <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[46%] aspect-square h-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/45" />
                  <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[46%] aspect-square h-[32%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
                </>
              )}
              {phase === "live" ? (
                <p className="absolute inset-x-0 top-14 mx-auto w-fit max-w-[85%] rounded-full bg-black/55 px-3 py-1 text-center text-sm font-medium text-white">
                  {purpose === "PORTION" ? c.fitHint : c.fitHintProof}
                </p>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-page/70 p-6 text-center">
                  <p role={phase === "blocked" ? "alert" : "status"} className="text-sm text-ink">
                    {statusText}
                  </p>
                  {phase === "blocked" && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setError(null);
                        setInfo(null);
                        setPhase("locating");
                      }}
                    >
                      {c.retry}
                    </button>
                  )}
                </div>
              )}
              {info?.qrRequired && (
                <span
                  aria-hidden="true"
                  className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border bg-page/80 px-2 py-1 text-xs font-semibold ${
                    qrOk ? "border-ok-500 text-ok-700" : "border-white/40 text-white/80"
                  }`}
                >
                  <QrIcon className="h-4 w-4" />
                  {qrOk ? "QR ✓" : "QR"}
                </span>
              )}
            </div>

            <dl className="card divide-y divide-line px-4" aria-live="polite">
              {checks.map(([label, value, ok]) => (
                <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <dt className="text-ink">{label}</dt>
                  <dd className={`text-right font-medium tabular-nums ${ok ? "text-ok-700" : "text-muted"}`}>{value}</dd>
                </div>
              ))}
            </dl>

            <button
              type="button"
              onClick={shoot}
              disabled={!canShoot}
              aria-label={c.shutter}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-white transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
            >
              <span className={`h-16 w-16 rounded-full bg-white ${busy ? "animate-pulse" : ""}`} />
            </button>

            <p className="pb-2 text-center text-xs text-muted">{c.footer}</p>
          </>
        )}
      </div>
    </div>
  );
}
