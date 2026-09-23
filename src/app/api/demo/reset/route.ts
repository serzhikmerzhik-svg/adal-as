import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getDemoSchool, todayRange } from "@/lib/demo";
import { recomputeSchoolRisk } from "@/lib/risk/score";

// Демо-мектеп пен байланысты партияларды бастапқы күйге қайтарады: бүгінгі алерттер,
// нұсқамалар мен тіркеулер өшіріледі.
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
  const affectedSchoolIds = Array.from(new Set(tracedAlerts.filter((a) => tracedIds.includes(a.id)).map((a) => a.schoolId)));

  await prisma.prescription.deleteMany({ where: { schoolId: school.id } });
  await prisma.alert.deleteMany({ where: { id: { in: [...redAlertIds, ...tracedIds] } } });
  await prisma.symptomReport.deleteMany({ where: { schoolId: school.id, reportedAt: { gte: start, lte: end } } });

  const todaysMenuItems = await prisma.menuItem.findMany({ where: { schoolId: school.id, date: { gte: start, lte: end } } });
  const menuItemIds = todaysMenuItems.map((m) => m.id);
  await prisma.kitchenLog.deleteMany({ where: { schoolId: school.id, menuItemId: { in: menuItemIds } } });
  await prisma.menuItem.deleteMany({ where: { id: { in: menuItemIds } } });

  const suppliers = await prisma.supplier.findMany({ where: { blocked: true } });
  for (const s of suppliers) {
    await prisma.supplier.update({ where: { id: s.id }, data: { blocked: false } });
  }

  await recomputeSchoolRisk(school.id);
  for (const schoolId of affectedSchoolIds) {
    await recomputeSchoolRisk(schoolId);
  }

  return NextResponse.json({ ok: true });
}
