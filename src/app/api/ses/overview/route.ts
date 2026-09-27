import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { todayRange } from "@/lib/date";
import { riskReasons } from "@/lib/risk/reasons";
import { getT } from "@/i18n/server";

// Дашборд әр 5 секунд сайын сұрайды: 500+ нысан үшін тек қажет өрістер жіберіледі.
export async function GET() {
  const t = await getT();
  const { start } = todayRange();

  const [schools, alerts, openAlerts, overduePrescriptions] = await Promise.all([
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
        relatedBatchId: true,
        rule: true,
        details: true,
        school: { select: { id: true, name: true, kind: true, address: true, district: { select: { name: true } } } },
      },
    }),
    prisma.alert.groupBy({ by: ["level"], where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } }, _count: true }),
    prisma.prescription.count({ where: { status: "OPEN", dueAt: { lt: new Date() } } }),
  ]);

  // Қызыл алерттен таралған сары алерттер саны (партияны қадағалау).
  const tracedCount = (redId: string) =>
    alerts.filter((a) => (a.details as { sourceAlertId?: string } | null)?.sourceAlertId === redId).length;

  // details интерфейске де жіберіледі: ереже алерттерінің мәтіні таңдалған тілде құрастырылады (alertText).
  const alertsOut = alerts.map((a) => ({
    ...a,
    batchCode: (a.details as { batchCode?: string } | null)?.batchCode ?? null,
    tracedCount: a.level === "RED" && !a.rule ? tracedCount(a.id) : 0,
  }));

  const openRedAlert = alertsOut.find((a) => a.level === "RED" && a.status === "OPEN");

  // «Кенет тексеруге ұсынылады»: сары/қызыл нысандар, негізгі себебімен және соңғы тексерумен.
  // Қызыл деңгей балдан бұрын тұрады: ашық қызыл алерт болса, балл 40 болса да нысан бірінші тексеріледі.
  const levelRank = { RED: 0, YELLOW: 1, GREEN: 2 };
  const flagged = schools
    .filter((s) => s.riskLevel !== "GREEN")
    .sort((a, b) => levelRank[a.riskLevel] - levelRank[b.riskLevel] || b.riskScore - a.riskScore);
  const flaggedIds = flagged.map((s) => s.id);
  const [details, snapshots, flaggedAlerts, planned] = await Promise.all([
    prisma.school.findMany({ where: { id: { in: flaggedIds } }, select: { id: true, address: true, lastInspectionAt: true } }),
    prisma.riskSnapshot.findMany({
      where: { schoolId: { in: flaggedIds } },
      orderBy: { computedAt: "desc" },
      distinct: ["schoolId"],
      select: { schoolId: true, components: true },
    }),
    prisma.alert.findMany({
      where: { schoolId: { in: flaggedIds }, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      select: { schoolId: true, level: true, rule: true, details: true, relatedBatchId: true },
    }),
    prisma.inspection.findMany({
      where: { schoolId: { in: flaggedIds }, doneAt: null, plannedAt: { gte: start } },
      orderBy: { plannedAt: "asc" },
      select: { schoolId: true, plannedAt: true },
    }),
  ]);
  const batchIds = flaggedAlerts.map((a) => a.relatedBatchId).filter((id): id is string => !!id);
  const batches = await prisma.batch.findMany({ where: { id: { in: batchIds } }, select: { id: true, code: true } });
  const batchCode = new Map(batches.map((b) => [b.id, b.code]));

  const unannounced = flagged.map((s) => {
    const d = details.find((x) => x.id === s.id);
    const components = snapshots.find((x) => x.schoolId === s.id)?.components as Record<string, number> | undefined;
    const schoolAlerts = flaggedAlerts
      .filter((a) => a.schoolId === s.id)
      .map((a) => ({ level: a.level, rule: a.rule, batchCode: a.relatedBatchId ? (batchCode.get(a.relatedBatchId) ?? null) : null }));
    return {
      ...s,
      address: d?.address ?? "",
      lastInspectionAt: d?.lastInspectionAt ?? null,
      plannedInspectionAt: planned.find((p) => p.schoolId === s.id)?.plannedAt ?? null,
      reasons: riskReasons(components, schoolAlerts, t),
    };
  });

  const count = (level: string) => schools.filter((s) => s.riskLevel === level).length;
  const openByLevel = (level: string) => openAlerts.find((g) => g.level === level)?._count ?? 0;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    schools,
    alerts: alertsOut,
    banner: openRedAlert ?? null,
    kpi: {
      total: schools.length,
      green: count("GREEN"),
      yellow: count("YELLOW"),
      red: count("RED"),
      openAlerts: openByLevel("RED") + openByLevel("YELLOW"),
      openRed: openByLevel("RED"),
      openYellow: openByLevel("YELLOW"),
      overduePrescriptions,
    },
    unannounced,
  });
}
