import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { todayDate } from "@/lib/date";
import { hasPlan, planDay } from "@/lib/plan";
import { getT } from "@/i18n/server";

/** «Мәзірді жоспардан толтыру»: бүгінгі жоспардағы тағамдар бір батырмамен қосылады (бар тағамдар қайталанбайды). */
export async function POST() {
  const t = await getT();
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: t.api.forbidden }, { status: 403 });
  const schoolId = session.schoolId;

  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { kind: true } });
  if (!hasPlan(school.kind)) return NextResponse.json({ error: t.api.invalid }, { status: 400 });

  const [plan, existing] = await Promise.all([
    prisma.menuPlanItem.findMany({ where: { kind: school.kind, day: planDay() }, orderBy: { category: "asc" } }),
    prisma.menuItem.findMany({ where: { schoolId, date: todayDate() }, select: { planItemId: true } }),
  ]);
  const taken = new Set(existing.map((m) => m.planItemId));
  const missing = plan.filter((p) => !taken.has(p.id));
  if (missing.length > 0) {
    await prisma.menuItem.createMany({
      data: missing.map((p) => ({
        schoolId,
        date: todayDate(),
        name: p.name,
        category: p.category,
        standardPortionG: p.portionG,
        planItemId: p.id,
      })),
    });
  }
  return NextResponse.json({ added: missing.length });
}
