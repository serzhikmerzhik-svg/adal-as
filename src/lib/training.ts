import { prisma } from "@/lib/db/prisma";
import { todayRange } from "@/lib/date";

/** Оқу-жаттығу режимінің нысаны: А-12 мектеп асханасы (seed оны isTraining белгісімен жасайды). */
export async function getTrainingSchool() {
  const school = await prisma.school.findFirst({ where: { code: "А-12", isTraining: true } });
  if (!school) throw new Error("А-12 оқу-жаттығу нысаны табылмады. Алдымен seed скриптін жүргізіңіз.");
  return school;
}

/** Нысанның бүгін жеткізілген (яғни бірнеше нысанға ортақ) партиясы. */
export async function getSharedBatch(schoolId: string) {
  const { start, end } = todayRange();
  const delivery = await prisma.delivery.findFirst({
    where: { schoolId, deliveredAt: { gte: start, lte: end } },
    include: { batch: true },
    orderBy: { deliveredAt: "desc" },
  });
  return delivery?.batch ?? null;
}
