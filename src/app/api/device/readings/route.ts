import { NextResponse, after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { armActive, hashDeviceKey } from "@/lib/devices";
import { DEVICE, TEMP } from "@/lib/risk/config";
import { isTempViolation, serveNorm } from "@/lib/temperature";
import { checkFridgeDevice } from "@/lib/rules";
import { recomputeSchoolRisk } from "@/lib/risk/score";

// Асхана құрылғысының API-і (ESP32 + DS18B20 сияқты термометр, тоңазытқыш датчигі):
//
//   POST /api/device/readings          Authorization: Bearer adk_…      {"value": 78.4}
//   GET  /api/device/readings          Authorization: Bearer adk_…      (күйі: қай тағам өлшенуге дайын)
//
// Жауап қысқа — құрылғының экраны мен жарық диоды үшін: status = OK | VIOLATION | SAVED.
// Құпиясөз не сессия жоқ: құрылғыны тек оның кілті анықтайды (ДБ-да кілттің sha256 хэші).

export const maxDuration = 30;

const bodySchema = z
  .object({ value: z.number().finite().optional(), valueC: z.number().finite().optional() })
  .refine((b) => b.value !== undefined || b.valueC !== undefined);

async function deviceFromRequest(request: Request) {
  const key = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? request.headers.get("x-device-key") ?? "";
  if (!key) return null;
  const device = await prisma.device.findUnique({ where: { keyHash: hashDeviceKey(key) } });
  return device && !device.revokedAt ? device : null;
}

/** Құрылғы күйі: «Өлшеу» басылған тағам бар ма (құрылғы «дайын» деп жыпылықтай алады). */
export async function GET(request: Request) {
  const device = await deviceFromRequest(request);
  if (!device) return NextResponse.json({ ok: false, error: "BAD_KEY" }, { status: 401 });
  const armed =
    device.kind === "PROBE" && device.armedTarget && armActive(device.armedAt)
      ? await prisma.menuItem.findUnique({ where: { id: device.armedTarget }, select: { name: true, category: true } })
      : null;
  await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({
    ok: true,
    device: device.label,
    kind: device.kind,
    armed: armed ? { dish: armed.name, norm: serveNorm(armed.category) } : null,
  });
}

export async function POST(request: Request) {
  const device = await deviceFromRequest(request);
  if (!device) return NextResponse.json({ ok: false, error: "BAD_KEY" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "BAD_BODY" }, { status: 400 });
  const value = Math.round((parsed.data.value ?? parsed.data.valueC!) * 10) / 10;
  if (value < -50 || value > 150) return NextResponse.json({ ok: false, error: "OUT_OF_RANGE" }, { status: 400 });

  // Бір құрылғыдан тым жиі келген өлшем қабылданбайды (батырма «дірілдесе» де бір жазба).
  const previous = await prisma.deviceReading.findFirst({ where: { deviceId: device.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (previous && Date.now() - previous.createdAt.getTime() < DEVICE.MIN_INTERVAL_MS) {
    return NextResponse.json({ ok: false, error: "TOO_FAST" }, { status: 429 });
  }

  // Термометр: қызметкер «Өлшеу» басқан тағам болса, өлшем сол тағамның журналына жазылады.
  let assigned: { dish: string; violation: boolean; norm: { min?: number; max?: number } } | null = null;
  let logId: string | null = null;
  if (device.kind === "PROBE" && device.armedTarget && armActive(device.armedAt)) {
    const item = await prisma.menuItem.findUnique({
      where: { id: device.armedTarget },
      select: { id: true, name: true, category: true, schoolId: true },
    });
    if (item && item.schoolId === device.schoolId) {
      const violation = isTempViolation("HOT_TEMP", value, item.category);
      const log = await prisma.kitchenLog.create({
        data: {
          schoolId: device.schoolId,
          menuItemId: item.id,
          type: "HOT_TEMP",
          valueC: value,
          isViolation: violation,
          source: "DEVICE",
          deviceId: device.id,
          createdById: `device:${device.id}`,
        },
      });
      logId = log.id;
      assigned = { dish: item.name, violation, norm: serveNorm(item.category) };
    }
  }

  await prisma.$transaction([
    prisma.deviceReading.create({ data: { deviceId: device.id, schoolId: device.schoolId, value, target: logId } }),
    prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date(), lastValue: value, ...(logId ? { armedTarget: null, armedAt: null } : {}) },
    }),
  ]);

  if (device.kind === "FRIDGE") after(() => checkFridgeDevice(device.id));
  if (logId) after(() => recomputeSchoolRisk(device.schoolId));

  const fridgeViolation = device.kind === "FRIDGE" && isTempViolation("FRIDGE_TEMP", value);
  return NextResponse.json({
    ok: true,
    device: device.label,
    kind: device.kind,
    value,
    status: assigned ? (assigned.violation ? "VIOLATION" : "OK") : device.kind === "FRIDGE" ? (fridgeViolation ? "VIOLATION" : "OK") : "SAVED",
    dish: assigned?.dish ?? null,
    norm: assigned?.norm ?? (device.kind === "FRIDGE" ? { min: TEMP.FRIDGE_MIN, max: TEMP.FRIDGE_MAX } : null),
  });
}
