import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { todayDate, todayRange } from "@/lib/date";
import { getT } from "@/i18n/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const { id } = await params;

  const school = await prisma.school.findUnique({
    where: { id },
    include: { district: true },
  });
  if (!school) return NextResponse.json({ error: t.api.notFound }, { status: 404 });

  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);
  const since7 = new Date(Date.now() - 7 * 86_400_000);
  const since24h = new Date(Date.now() - 86_400_000);
  const { start } = todayRange();

  const [riskHistory, kitchenLogs, symptomReports, feedback, inspections, prescriptions, alerts, todayMenu, devices, staff, waste] =
    await Promise.all([
      prisma.riskSnapshot.findMany({
        where: { schoolId: id, computedAt: { gte: since30 } },
        orderBy: { computedAt: "asc" },
      }),
      prisma.kitchenLog.findMany({
        where: { schoolId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { menuItem: true },
      }),
      // Баланың аты-жөні СЭС-ке берілмейді: ол тек мектеп медбикесінде.
      prisma.symptomReport.findMany({
        where: { schoolId: id },
        orderBy: { reportedAt: "desc" },
        take: 50,
        select: { id: true, grade: true, symptoms: true, otherNote: true, reportedAt: true },
      }),
      prisma.parentFeedback.findMany({
        where: { schoolId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.inspection.findMany({ where: { schoolId: id }, orderBy: { plannedAt: "desc" } }),
      prisma.prescription.findMany({ where: { schoolId: id }, orderBy: { dueAt: "desc" } }),
      prisma.alert.findMany({ where: { schoolId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
      // Бүгінгі мәзір: жоспар мен техкарта, партия, соңғы температура (қолмен/құрылғы), порция фотосы, жеу индексі.
      prisma.menuItem.findMany({
        where: { schoolId: id, date: todayDate() },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          category: true,
          offPlanReason: true,
          planItem: { select: { mainIngredient: true } },
          batch: { select: { code: true, product: true } },
          logs: {
            where: { type: { in: ["HOT_TEMP", "PHOTO", "WASTE"] } },
            orderBy: { createdAt: "desc" },
            select: { type: true, valueC: true, isViolation: true, source: true, aiStatus: true, aiWastePct: true, createdAt: true },
          },
        },
      }),
      // Құрылғылар мен тоңазытқыш датчигінің соңғы тәулігі (кілт хэші жіберілмейді).
      prisma.device.findMany({
        where: { schoolId: id, revokedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          kind: true,
          label: true,
          lastSeenAt: true,
          lastValue: true,
          readings: { where: { createdAt: { gte: since24h } }, orderBy: { createdAt: "asc" }, select: { value: true, createdAt: true } },
        },
      }),
      prisma.staff.findMany({
        where: { schoolId: id, active: true },
        orderBy: { label: "asc" },
        select: {
          id: true,
          label: true,
          checks: {
            where: { createdAt: { gte: start } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { aiStatus: true, aiIssues: true, createdAt: true },
          },
        },
      }),
      prisma.kitchenLog.findMany({
        where: { schoolId: id, type: "WASTE", createdAt: { gte: since7 }, aiWastePct: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { id: true, aiWastePct: true, createdAt: true, menuItem: { select: { name: true } } },
      }),
    ]);

  const latestComponents = riskHistory.at(-1)?.components ?? null;

  return NextResponse.json({
    school,
    latestComponents,
    riskHistory,
    kitchenLogs,
    symptomReports,
    feedback,
    inspections,
    prescriptions,
    alerts,
    ops: { todayMenu, devices, staff, waste },
    // Құрылғының «желіде» күйі сервер уақыты бойынша есептеледі.
    generatedAt: Date.now(),
  });
}
