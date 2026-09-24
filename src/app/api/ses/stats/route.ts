import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { todayDate, todayRange } from "@/lib/date";

const DYNAMICS_DAYS = 30;

type DynamicsRow = { day: string; level: "YELLOW" | "RED"; n: number };

// Дашбордтың төменгі карточкалары: бүгінгі асхана журналдары, тәуекел динамикасы,
// бүгінгі тексерулер мен нұсқамалар. Жиі өзгермейді, сондықтан 30 секунд сайын сұралады.
export async function GET() {
  const { start, end } = todayRange();
  const today = { gte: start, lte: end };
  const dynamicsSince = new Date();
  dynamicsSince.setUTCDate(dynamicsSince.getUTCDate() - DYNAMICS_DAYS);

  const [total, menuToday, photoToday, tempToday, deliveriesToday, violationsToday, inspections, presOpen, presSubmitted, presOverdue, dynamicsRows] =
    await Promise.all([
      prisma.school.count(),
      prisma.menuItem.groupBy({ by: ["schoolId"], where: { date: todayDate() } }),
      prisma.kitchenLog.groupBy({ by: ["schoolId"], where: { type: "PHOTO", createdAt: today } }),
      prisma.kitchenLog.groupBy({ by: ["schoolId"], where: { type: { in: ["FRIDGE_TEMP", "HOT_TEMP"] }, createdAt: today } }),
      prisma.delivery.count({ where: { deliveredAt: today } }),
      prisma.kitchenLog.count({ where: { isViolation: true, createdAt: today } }),
      prisma.inspection.findMany({
        where: { plannedAt: today },
        orderBy: { plannedAt: "asc" },
        select: {
          id: true,
          type: true,
          plannedAt: true,
          doneAt: true,
          result: true,
          school: { select: { id: true, name: true, kind: true, riskLevel: true } },
        },
      }),
      prisma.prescription.count({ where: { status: "OPEN" } }),
      prisma.prescription.count({ where: { status: "SUBMITTED" } }),
      prisma.prescription.count({ where: { status: "OPEN", dueAt: { lt: new Date() } } }),
      // Әр күн үшін әр нысанның сол күнгі соңғы деңгейі; жасыл емес нысандар саналады.
      prisma.$queryRaw<DynamicsRow[]>`
        SELECT to_char(day, 'YYYY-MM-DD') AS day, level::text AS level, count(*)::int AS n
        FROM (
          SELECT DISTINCT ON ("schoolId", date_trunc('day', "computedAt"))
            date_trunc('day', "computedAt") AS day, level
          FROM "RiskSnapshot"
          WHERE "computedAt" >= ${dynamicsSince}
          ORDER BY "schoolId", date_trunc('day', "computedAt"), "computedAt" DESC
        ) t
        WHERE level <> 'GREEN'
        GROUP BY day, level
        ORDER BY day`,
    ]);

  const photoIds = photoToday.map((r) => r.schoolId);
  const missing = await prisma.school.findMany({
    where: { id: { notIn: photoIds } },
    orderBy: [{ riskScore: "desc" }, { name: "asc" }],
    take: 3,
    select: { id: true, name: true, kind: true },
  });

  const dynamics: { date: string; yellow: number; red: number }[] = [];
  for (let i = DYNAMICS_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const rows = dynamicsRows.filter((r) => r.day === key);
    dynamics.push({
      date: key,
      yellow: rows.find((r) => r.level === "YELLOW")?.n ?? 0,
      red: rows.find((r) => r.level === "RED")?.n ?? 0,
    });
  }

  return NextResponse.json({
    journal: {
      total,
      withMenu: menuToday.length,
      withPhoto: photoIds.length,
      withTemp: tempToday.length,
      deliveriesToday,
      violationsToday,
      missing,
      missingCount: total - photoIds.length,
    },
    dynamics,
    inspections,
    prescriptions: { open: presOpen, submitted: presSubmitted, overdue: presOverdue },
  });
}
