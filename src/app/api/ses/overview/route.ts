import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const [schools, alerts, openAlertsCount, overduePrescriptionsCount] = await Promise.all([
    prisma.school.findMany({
      include: { district: true },
      orderBy: { riskScore: "desc" },
    }),
    prisma.alert.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { school: { include: { district: true } } },
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

  const unannouncedList = schools
    .filter((s) => s.riskLevel !== "GREEN")
    .sort((a, b) => b.riskScore - a.riskScore);

  return NextResponse.json({ schools, alerts, kpi, unannouncedList });
}
