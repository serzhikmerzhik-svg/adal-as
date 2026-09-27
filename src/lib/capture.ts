import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

// Камерадан түсірудің серверлік тексерісі: геолокация, бір реттік токен, QR-тұғыр.

/** Токеннің жарамдылығы: осы уақыт ішінде түсіріп, жүктеу керек. */
export const CAPTURE_TTL_MS = 120_000;

/** Түсіру токен мерзімінде жасалады (UI тексереді), ал жүктеуге баяу интернетте қосымша уақыт беріледі. */
const UPLOAD_GRACE_MS = 60_000;

/** Асханадағы QR-тұғырдың мазмұны: нысан коды. */
export const qrPayload = (code: string) => `ADALAS:${code}`;

/** Нысанның айналасындағы рұқсат етілген радиус (м). */
export function geofenceRadiusM() {
  const value = Number(process.env.GEOFENCE_M);
  return Number.isFinite(value) && value > 0 ? value : 150;
}

/** Оқу-жаттығу нысандарында (А-12, К-14) геолокация тексерілмейді: қорғауда залдан түсіруге болады. QR-тұғыр бәрібір міндетті. */
export function trainingBypassEnabled() {
  return process.env.TRAINING_GEOFENCE_BYPASS !== "false";
}

/** Екі нүкте арасындағы қашықтық, метр (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

/** PORTION — порция, PROOF — нұсқаманың фото-дәлелі, STAFF — қызметкер формасы, WASTE — қайтарылған табақтар. */
export type CapturePurpose = "PORTION" | "PROOF" | "STAFF" | "WASTE";

export async function issueCaptureToken(input: { schoolId: string; purpose: CapturePurpose; targetId: string; distanceM: number | null }) {
  const token = await prisma.captureToken.create({
    data: {
      id: randomBytes(24).toString("base64url"),
      schoolId: input.schoolId,
      purpose: input.purpose,
      targetId: input.targetId,
      distanceM: input.distanceM,
      expiresAt: new Date(Date.now() + CAPTURE_TTL_MS),
    },
  });
  return token;
}

/** Токенді бір рет қана өтейді: мерзімі өтпеген, қолданылмаған және дәл осы нысан мен мақсатқа берілген болуы керек. */
export async function consumeCaptureToken(input: { token: string; schoolId: string; purpose: CapturePurpose; targetId: string }) {
  const result = await prisma.captureToken.updateMany({
    where: {
      id: input.token,
      schoolId: input.schoolId,
      purpose: input.purpose,
      targetId: input.targetId,
      usedAt: null,
      expiresAt: { gt: new Date(Date.now() - UPLOAD_GRACE_MS) },
    },
    data: { usedAt: new Date() },
  });
  return result.count === 1;
}

/** QR-тұғыр порция фотосында әрқашан міндетті; нұсқаманың фото-дәлелінде (жөнделген жабдық т.б.) — жоқ. */
export const qrRequired = (purpose: CapturePurpose) => purpose === "PORTION";

/** Клиент суретті ≤220 КБ-қа дейін сығады; base64 түрінде шамамен 300 КБ. Қор ретінде 600 мың таңба. */
export const MAX_PHOTO_CHARS = 600_000;

/** Фото тек өз жүктеуімізден: сығылған data:image не Vercel Blob. Сырттағы URL қабылданбайды — сервер бөгде адреске сұраныс жібермейді. */
export function isOwnPhotoUrl(url: string) {
  if (url.startsWith("data:")) return url.length <= MAX_PHOTO_CHARS && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url);
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}
