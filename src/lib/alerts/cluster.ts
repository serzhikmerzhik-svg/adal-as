import { prisma } from "@/lib/db/prisma";
import { CLUSTER } from "@/lib/risk/config";
import { findSchoolsForBatches } from "@/lib/trace/batchTrace";
import { recomputeSchoolRisk } from "@/lib/risk/score";
import type { Symptom } from "@prisma/client";

function minutesAgo(n: number) {
  const d = new Date();
  d.setMinutes(d.getMinutes() - n);
  return d;
}

function hoursAgo(n: number) {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}

const GI_SET = new Set<string>(CLUSTER.GI_SYMPTOMS);

/**
 * Жаңа белгі тіркелгеннен кейін шақырылады. WINDOW_MIN терезесінде MIN_REPORTS-тен
 * көп GI-белгісі бар тіркеу болса, RED алерт жасайды, бүгінгі мәзірді бұғаттайды
 * және сол партияларды алған басқа мектептерге YELLOW алерт таратады.
 */
export async function checkClusterAndAlert(schoolId: string) {
  const recentReports = await prisma.symptomReport.findMany({
    where: { schoolId, reportedAt: { gte: minutesAgo(CLUSTER.WINDOW_MIN) } },
  });
  const giReports = recentReports.filter((r) => r.symptoms.some((s: Symptom) => GI_SET.has(s)));

  if (giReports.length < CLUSTER.MIN_REPORTS) return null;

  const existingOpenRed = await prisma.alert.findFirst({
    where: { schoolId, level: "RED", createdAt: { gte: hoursAgo(24) }, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
  });
  if (existingOpenRed) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todaysMenu = await prisma.menuItem.findMany({
    where: { schoolId, date: { gte: todayStart, lte: todayEnd } },
    include: { batch: { include: { supplier: true } } },
  });

  const batchIds = Array.from(new Set(todaysMenu.map((m) => m.batchId).filter((b): b is string => !!b)));

  const alert = await prisma.alert.create({
    data: {
      schoolId,
      level: "RED",
      reason: `${giReports.length} оқушыда ${CLUSTER.WINDOW_MIN} минут ішінде ішек-қарын белгілері тіркелді`,
      relatedBatchId: batchIds[0] ?? null,
      details: {
        reportIds: giReports.map((r) => r.id),
        menu: todaysMenu.map((m) => ({
          id: m.id,
          name: m.name,
          batchId: m.batchId,
          supplier: m.batch?.supplier?.name ?? null,
        })),
      },
    },
  });

  const affectedSchoolIds = [schoolId];
  const [sourceSchool, otherSchools] = await Promise.all([
    prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true } }),
    batchIds.length > 0 ? findSchoolsForBatches(batchIds, schoolId) : Promise.resolve([]),
    todaysMenu.length > 0
      ? prisma.menuItem.updateMany({ where: { id: { in: todaysMenu.map((m) => m.id) } }, data: { blocked: true } })
      : Promise.resolve(null),
  ]);

  if (otherSchools.length > 0) {
    const batchCodes = new Map(todaysMenu.filter((m) => m.batch).map((m) => [m.batch!.id, m.batch!.code]));
    await prisma.alert.createMany({
      data: otherSchools.flatMap(({ school, batchIds: matched }) =>
        matched.map((batchId) => ({
          schoolId: school.id,
          level: "YELLOW" as const,
          reason: `Партия №${batchCodes.get(batchId)}: "${sourceSchool.name}" мектебінде улану кластері анықталды`,
          relatedBatchId: batchId,
          details: { sourceSchoolId: schoolId, sourceAlertId: alert.id, batchCode: batchCodes.get(batchId) ?? null },
        })),
      ),
    });
    affectedSchoolIds.push(...otherSchools.map((o) => o.school.id));
  }

  await Promise.all(affectedSchoolIds.map((id) => recomputeSchoolRisk(id)));

  return alert;
}
