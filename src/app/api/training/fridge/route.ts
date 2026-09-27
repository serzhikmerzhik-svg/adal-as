import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getTrainingSchool } from "@/lib/training";
import { hashDeviceKey, keyHint, newDeviceKey } from "@/lib/devices";
import { checkFridgeDevice } from "@/lib/rules";

export const maxDuration = 60;

// Қосымша сценарий: тоңазытқыш датчигінің ақауы. Құрылғы 5 минут сайын өлшем жібергендей төрт өлшем
// жазылады (5,2 → 11,3 °C); қатарынан үш өлшем нормадан жоғары болғанда ереже қызыл дабыл береді.
const SERIES = [5.2, 7.4, 9.1, 11.3];

export async function POST() {
  const school = await getTrainingSchool();
  let device = await prisma.device.findFirst({ where: { schoolId: school.id, kind: "FRIDGE", revokedAt: null } });
  if (!device) {
    const key = newDeviceKey(); // жаттығу датчигінің кілті ешкімге көрсетілмейді
    device = await prisma.device.create({
      data: { schoolId: school.id, kind: "FRIDGE", label: "Ет тоңазытқышы", keyHash: hashDeviceKey(key), keyHint: keyHint(key) },
    });
  }

  const now = Date.now();
  await prisma.deviceReading.createMany({
    data: SERIES.map((value, i) => ({
      deviceId: device.id,
      schoolId: school.id,
      value,
      createdAt: new Date(now - (SERIES.length - 1 - i) * 5 * 60_000),
    })),
  });
  await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date(now), lastValue: SERIES[SERIES.length - 1] } });
  const alert = await checkFridgeDevice(device.id);

  return NextResponse.json({ peak: Math.max(...SERIES), alertId: alert?.id ?? null, device: device.label });
}
