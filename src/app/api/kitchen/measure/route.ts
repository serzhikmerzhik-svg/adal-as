import { NextResponse, after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { DEVICE } from "@/lib/risk/config";
import { isTempViolation } from "@/lib/temperature";
import { recomputeSchoolRisk } from "@/lib/risk/score";
import { todayDate } from "@/lib/date";
import { getT } from "@/i18n/server";

const bodySchema = z.object({ menuItemId: z.string().min(1) });

/**
 * «Термометрмен өлшеу»: асхананың термометр-щуптары осы тағамға «дайын» болады, келесі өлшем
 * (ARM_WINDOW_S ішінде) тағам журналына жазылады. Өлшем батырмадан сәл бұрын келген болса
 * (EARLY_READING_S ішінде), ол бірден осы тағамға жазылады.
 */
export async function POST(request: Request) {
  const t = await getT();
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: t.api.forbidden }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.invalid }, { status: 400 });

  const schoolId = session.schoolId;
  const item = await prisma.menuItem.findFirst({
    where: { id: parsed.data.menuItemId, schoolId, date: todayDate() },
    select: { id: true, category: true },
  });
  if (!item) return NextResponse.json({ error: t.api.notFound }, { status: 404 });

  const probes = await prisma.device.findMany({ where: { schoolId, kind: "PROBE", revokedAt: null }, select: { id: true } });
  if (probes.length === 0) return NextResponse.json({ error: t.devices.noProbe }, { status: 404 });

  const early = await prisma.deviceReading.findFirst({
    where: {
      deviceId: { in: probes.map((p) => p.id) },
      target: null,
      createdAt: { gte: new Date(Date.now() - DEVICE.EARLY_READING_S * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (early) {
    const violation = isTempViolation("HOT_TEMP", early.value, item.category);
    const log = await prisma.kitchenLog.create({
      data: {
        schoolId,
        menuItemId: item.id,
        type: "HOT_TEMP",
        valueC: early.value,
        isViolation: violation,
        source: "DEVICE",
        deviceId: early.deviceId,
        createdById: session.userId,
      },
    });
    await prisma.deviceReading.update({ where: { id: early.id }, data: { target: log.id } });
    after(() => recomputeSchoolRisk(schoolId));
    return NextResponse.json({ assigned: { valueC: early.value, violation } });
  }

  const armedAt = new Date();
  await prisma.device.updateMany({ where: { id: { in: probes.map((p) => p.id) } }, data: { armedTarget: item.id, armedAt } });
  return NextResponse.json({ armedUntil: new Date(armedAt.getTime() + DEVICE.ARM_WINDOW_S * 1000).toISOString() });
}

/** Өлшеуді болдырмау. */
export async function DELETE() {
  const t = await getT();
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: t.api.forbidden }, { status: 403 });
  await prisma.device.updateMany({ where: { schoolId: session.schoolId, kind: "PROBE" }, data: { armedTarget: null, armedAt: null } });
  return NextResponse.json({ ok: true });
}
