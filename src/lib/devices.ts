import { createHash, randomBytes } from "node:crypto";
import { DEVICE } from "@/lib/risk/config";

// Құрылғы кілті тек бір рет көрсетіледі; ДБ-да оның sha256 хэші мен соңғы 4 таңбасы ғана сақталады.
export const hashDeviceKey = (key: string) => createHash("sha256").update(key).digest("hex");
export const newDeviceKey = () => `adk_${randomBytes(24).toString("base64url")}`;
export const keyHint = (key: string) => key.slice(-4);

/** Құрылғы соңғы ONLINE_MIN минутта сигнал берді ме. */
export function isOnline(lastSeenAt: Date | string | null | undefined, now = Date.now()) {
  return !!lastSeenAt && now - new Date(lastSeenAt).getTime() < DEVICE.ONLINE_MIN * 60_000;
}

/** «Өлшеу» әлі белсенді ме: басылғаннан кейін ARM_WINDOW_S секунд. */
export function armActive(armedAt: Date | string | null | undefined, now = Date.now()) {
  return !!armedAt && now - new Date(armedAt).getTime() < DEVICE.ARM_WINDOW_S * 1000;
}
