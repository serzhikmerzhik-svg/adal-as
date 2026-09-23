import { prisma } from "@/lib/db/prisma";
import { CLUSTER } from "@/lib/risk/config";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** Берілген партиялар соңғы TRACE_DAYS ішінде жеткізілген барлық мектептерді табады. */
export async function findSchoolsForBatches(batchIds: string[], excludeSchoolId?: string) {
  const deliveries = await prisma.delivery.findMany({
    where: {
      batchId: { in: batchIds },
      deliveredAt: { gte: daysAgo(CLUSTER.TRACE_DAYS) },
      ...(excludeSchoolId ? { schoolId: { not: excludeSchoolId } } : {}),
    },
    include: { school: true, batch: true },
  });

  const bySchool = new Map<string, { school: typeof deliveries[number]["school"]; batchIds: Set<string> }>();
  for (const d of deliveries) {
    const entry = bySchool.get(d.schoolId) ?? { school: d.school, batchIds: new Set<string>() };
    entry.batchIds.add(d.batchId);
    bySchool.set(d.schoolId, entry);
  }
  return Array.from(bySchool.values()).map((e) => ({ school: e.school, batchIds: Array.from(e.batchIds) }));
}
