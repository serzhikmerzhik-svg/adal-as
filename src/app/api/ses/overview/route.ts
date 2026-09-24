import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  // 500+ нысан әр 5 секунд сайын сұралады, сондықтан тек қажет өрістер жіберіледі.
  const [schools, alerts, openAlertsCount, overduePrescriptionsCount] = await Promise.all([
    prisma.school.findMany({
      select: {
        id: true,
        name: true,
        kind: true,
        lat: true,
        lng: true,
        riskScore: true,
        riskLevel: true,
        district: { select: { id: true, name: true } },
      },
      orderBy: { riskScore: "desc" },
    }),
    prisma.alert.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        level: true,
        reason: true,
        status: true,
        createdAt: true,
        school: { select: { name: true, kind: true } },
      },
    }),
    prisma.alert.count({ where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } } }),
    prisma.prescription.count({ where: { status: "OPEN", dueAt: { lt: new Date() } } }),
  ]);

  const kpi = {
    green: schools.filter((s) => s.riskLevel === "GREEN").length,
    yellow: schools.filter((s) => s.riskLevel === "YELLOW").length,
    red: schools.filter((s) => s.riskLevel === "RED").length,
    openAlerts: openAlertsCount,
    overduePrescriptions: overduePrescriptionsCount,
  };

  const unannouncedList = schools.filter((s) => s.riskLevel !== "GREEN");

  return NextResponse.json({ schools, alerts, kpi, unannouncedList });
}
