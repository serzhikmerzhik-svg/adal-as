import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { todayDate, todayRange } from "@/lib/date";
import { hasPlan, planDay } from "@/lib/plan";
import { getT } from "@/i18n/server";

// Асхана бетінің бір сұранысы: бүгінгі мәзір, жоспар, құрылғылар, қызметкерлер тексеруі, партиялар, нұсқамалар.
export async function GET() {
  const t = await getT();
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: t.api.forbidden }, { status: 400 });
  const schoolId = session.schoolId;
  const { start } = todayRange();

  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, kind: true, code: true } });
  if (!school) return NextResponse.json({ error: t.api.notFound }, { status: 404 });
  const day = hasPlan(school.kind) ? planDay() : null;

  const [menuItems, prescriptions, suppliers, plan, devices, staff, batches] = await Promise.all([
    prisma.menuItem.findMany({
      where: { schoolId, date: todayDate() },
      include: {
        batch: { include: { supplier: true } },
        planItem: { select: { mainIngredient: true, composition: true } },
        logs: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.prescription.findMany({
      where: { schoolId, status: { in: ["OPEN", "SUBMITTED"] } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    day ? prisma.menuPlanItem.findMany({ where: { kind: school.kind, day }, orderBy: { category: "asc" } }) : [],
    prisma.device.findMany({
      where: { schoolId, revokedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, kind: true, label: true, keyHint: true, lastSeenAt: true, lastValue: true, armedTarget: true, armedAt: true },
    }),
    prisma.staff.findMany({
      where: { schoolId, active: true },
      orderBy: { label: "asc" },
      select: {
        id: true,
        label: true,
        checks: {
          where: { createdAt: { gte: start } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, createdAt: true, aiStatus: true, aiIssues: true, aiSummary: true },
        },
      },
    }),
    // Соңғы 14 күнде осы асханаға жеткізілген партиялар: тағамға негізгі өнім ретінде байланады.
    prisma.batch.findMany({
      where: { deliveries: { some: { schoolId, deliveredAt: { gte: new Date(Date.now() - 14 * 86_400_000) } } } },
      orderBy: { code: "asc" },
      select: { id: true, code: true, product: true, supplier: { select: { name: true, blocked: true } } },
    }),
  ]);

  return NextResponse.json({ school, planDay: day, plan, menuItems, prescriptions, suppliers, devices, staff, batches });
}
