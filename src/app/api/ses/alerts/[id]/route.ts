import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { findSchoolsForBatches } from "@/lib/trace/batchTrace";
import { todayDate } from "@/lib/date";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const alert = await prisma.alert.findUnique({
    where: { id },
    include: { school: { include: { district: true } } },
  });
  if (!alert) return NextResponse.json({ error: "Алерт табылмады" }, { status: 404 });

  const since24h = new Date();
  since24h.setHours(since24h.getHours() - 24);

  // Баланың аты-жөні СЭС-ке берілмейді: ол тек мектеп медбикесінде.
  const symptomReports = await prisma.symptomReport.findMany({
    where: { schoolId: alert.schoolId, reportedAt: { gte: since24h } },
    orderBy: { reportedAt: "desc" },
    select: { id: true, grade: true, symptoms: true, otherNote: true, reportedAt: true },
  });

  const todaysMenu = await prisma.menuItem.findMany({
    where: { schoolId: alert.schoolId, date: todayDate() },
    include: { batch: { include: { supplier: true } } },
  });

  const batchIds = Array.from(new Set(todaysMenu.map((m) => m.batchId).filter((b): b is string => !!b)));
  const trace = batchIds.length > 0 ? await findSchoolsForBatches(batchIds, alert.schoolId) : [];

  return NextResponse.json({ alert, symptomReports, todaysMenu, trace });
}

const patchSchema = z.object({
  action: z.enum(["acknowledge", "close"]),
  closingNote: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role !== "SES") return NextResponse.json({ error: "Рұқсат жоқ" }, { status: 403 });

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Дұрыс емес деректер" }, { status: 400 });

  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) return NextResponse.json({ error: "Алерт табылмады" }, { status: 404 });

  const data =
    parsed.data.action === "acknowledge"
      ? { status: "ACKNOWLEDGED" as const, acknowledgedAt: new Date() }
      : { status: "CLOSED" as const, closedAt: new Date(), closingNote: parsed.data.closingNote ?? null };

  const updated = await prisma.alert.update({ where: { id }, data });

  const { recomputeSchoolRisk } = await import("@/lib/risk/score");
  await recomputeSchoolRisk(alert.schoolId);

  return NextResponse.json({ alert: updated });
}
