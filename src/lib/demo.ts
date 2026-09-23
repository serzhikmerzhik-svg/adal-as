import { prisma } from "@/lib/db/prisma";

export async function getDemoSchool() {
  const school = await prisma.school.findFirst({ where: { isDemo: true } });
  if (!school) throw new Error("Демо-мектеп табылмады. Алдымен seed скриптін жүргізіңіз.");
  return school;
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
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

export { todayRange };
