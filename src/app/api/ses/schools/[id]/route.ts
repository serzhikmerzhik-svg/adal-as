import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const school = await prisma.school.findUnique({
    where: { id },
    include: { district: true },
  });
  if (!school) return NextResponse.json({ error: "Мектеп табылмады" }, { status: 404 });

  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);

  const [riskHistory, kitchenLogs, symptomReports, feedback, inspections, prescriptions, alerts] =
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
      prisma.symptomReport.findMany({
        where: { schoolId: id },
        orderBy: { reportedAt: "desc" },
        take: 50,
      }),
      prisma.parentFeedback.findMany({
        where: { schoolId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.inspection.findMany({ where: { schoolId: id }, orderBy: { plannedAt: "desc" } }),
      prisma.prescription.findMany({ where: { schoolId: id }, orderBy: { dueAt: "desc" } }),
      prisma.alert.findMany({ where: { schoolId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
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
  });
}
