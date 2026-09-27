import { NextResponse, after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { todayDate } from "@/lib/date";
import { hasPlan, planDay } from "@/lib/plan";
import { checkMenuCompliance } from "@/lib/rules";
import { getT } from "@/i18n/server";

const CATEGORIES = ["SOUP", "MAIN", "HOT_DRINK", "COLD"] as const;

// Мектеп пен балабақша тағамды СЭС бекіткен жоспардан таңдайды (planItemId). Жоспардан тыс тағам
// тек себебімен қосылады және СЭС-ке сары алерт кетеді. Басқа нысандарда мәзір еркін.
const bodySchema = z.object({
  planItemId: z.string().optional(),
  name: z.string().trim().min(1).max(80).optional(),
  category: z.enum(CATEGORIES).optional(),
  standardPortionG: z.number().int().positive().max(2000).optional(),
  offPlanReason: z.string().trim().max(200).optional(),
  batchId: z.string().optional(),
});

export async function POST(request: Request) {
  const t = await getT();
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: t.api.forbidden }, { status: 400 });
  const schoolId = session.schoolId;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: t.api.invalid }, { status: 400 });
  const body = parsed.data;

  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { kind: true } });

  // Партия осы асханаға жеткізілген болуы керек.
  if (body.batchId) {
    const delivered = await prisma.delivery.findFirst({ where: { schoolId, batchId: body.batchId }, select: { id: true } });
    if (!delivered) return NextResponse.json({ error: t.api.invalid }, { status: 400 });
  }

  let data;
  if (body.planItemId) {
    const plan = await prisma.menuPlanItem.findFirst({ where: { id: body.planItemId, kind: school.kind, day: planDay() } });
    if (!plan) return NextResponse.json({ error: t.api.notFound }, { status: 404 });
    data = { name: plan.name, category: plan.category, standardPortionG: plan.portionG, planItemId: plan.id };
  } else {
    if (!body.name) return NextResponse.json({ error: t.api.invalid }, { status: 400 });
    const reason = body.offPlanReason?.trim();
    if (hasPlan(school.kind) && !reason) return NextResponse.json({ error: t.plan.reasonRequired }, { status: 400 });
    data = {
      name: body.name,
      category: body.category ?? "MAIN",
      standardPortionG: body.standardPortionG,
      offPlanReason: hasPlan(school.kind) ? reason : null,
    };
  }

  const menuItem = await prisma.menuItem.create({
    data: { schoolId, date: todayDate(), batchId: body.batchId, ...data },
  });
  after(() => checkMenuCompliance(menuItem.id));

  return NextResponse.json({ menuItem });
}
