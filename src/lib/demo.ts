import { prisma } from "@/lib/db/prisma";
import { todayRange } from "@/lib/date";

export async function getDemoSchool() {
  const school = await prisma.school.findFirst({ where: { isDemo: true } });
  if (!school) throw new Error("Демо-мектеп табылмады. Алдымен seed скриптін жүргізіңіз.");
  return school;
}

/** Демо-мектептің бүгінгі жеткізілген (яғни бірнеше мектепке ортақ) партиясы. */
export async function getSharedBatch(demoSchoolId: string) {
  const { start, end } = todayRange();
  const delivery = await prisma.delivery.findFirst({
    where: { schoolId: demoSchoolId, deliveredAt: { gte: start, lte: end } },
    include: { batch: true },
    orderBy: { deliveredAt: "desc" },
  });
  return delivery?.batch ?? null;
}
