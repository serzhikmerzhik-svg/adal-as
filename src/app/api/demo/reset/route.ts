import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getDemoSchool } from "@/lib/demo";
import { todayDate, todayRange } from "@/lib/date";
import { recomputeSchoolRisk } from "@/lib/risk/score";
import { mapLimit } from "@/lib/concurrency";

export const maxDuration = 60;

// Демо-мектеп пен байланысты партияларды бастапқы күйге қайтарады: бүгінгі алерттер,
// нұсқамалар, тексерулер мен тіркеулер өшіріледі, бұғатталған жеткізушілер ашылады.
export async function POST() {
  const school = await getDemoSchool();
  const { start, end } = todayRange();

  const redAlerts = await prisma.alert.findMany({
    where: { schoolId: school.id, level: "RED", createdAt: { gte: start, lte: end } },
  });
  const redAlertIds = redAlerts.map((a) => a.id);

  const tracedAlerts = await prisma.alert.findMany({
    where: { createdAt: { gte: start, lte: end }, schoolId: { not: school.id } },
  });
  const tracedIds = tracedAlerts
    .filter((a) => redAlertIds.includes((a.details as { sourceAlertId?: string })?.sourceAlertId ?? ""))
    .map((a) => a.id);
  const tracedSchoolIds = tracedAlerts.filter((a) => tracedIds.includes(a.id)).map((a) => a.schoolId);

  await prisma.prescription.deleteMany({ where: { schoolId: school.id } });
  await prisma.alert.deleteMany({ where: { id: { in: [...redAlertIds, ...tracedIds] } } });
  await prisma.symptomReport.deleteMany({ where: { schoolId: school.id, reportedAt: { gte: start, lte: end } } });
  // Демо кезінде тағайындалған, әлі орындалмаған тексерулер (seed тексерулерінде doneAt бар).
  await prisma.inspection.deleteMany({ where: { doneAt: null, plannedAt: { gte: start } } });

  const todaysMenuItems = await prisma.menuItem.findMany({ where: { schoolId: school.id, date: todayDate() } });
  const menuItemIds = todaysMenuItems.map((m) => m.id);
  await prisma.kitchenLog.deleteMany({ where: { schoolId: school.id, menuItemId: { in: menuItemIds } } });
  await prisma.menuItem.deleteMany({ where: { id: { in: menuItemIds } } });

  // Бұғатталған жеткізушіні ашқанда оның нысандарының тәуекелі де қайта есептелуі керек.
  const blocked = await prisma.supplier.findMany({ where: { blocked: true }, select: { id: true } });
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const supplierSchools = blocked.length
    ? await prisma.delivery.findMany({
        where: { batch: { supplierId: { in: blocked.map((s) => s.id) } }, deliveredAt: { gte: since } },
        distinct: ["schoolId"],
        select: { schoolId: true },
      })
    : [];
  await prisma.supplier.updateMany({ where: { blocked: true }, data: { blocked: false } });

  // Демо-мектеп пен партиясы бар нысандар бірден жаңарады, жеткізушінің қалған нысандары — жауаптан кейін.
  const immediate = [school.id, ...tracedSchoolIds];
  await Promise.all(immediate.map((id) => recomputeSchoolRisk(id)));
  const rest = supplierSchools.map((d) => d.schoolId).filter((id) => !immediate.includes(id));
  if (rest.length) after(() => mapLimit(rest, 10, (id) => recomputeSchoolRisk(id)));

  return NextResponse.json({ ok: true, recomputingInBackground: rest.length });
}
