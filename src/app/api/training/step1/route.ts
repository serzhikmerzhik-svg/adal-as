import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { DishCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getTrainingSchool, getSharedBatch } from "@/lib/training";
import { todayDate } from "@/lib/date";
import { ingredientMatches, planDay } from "@/lib/plan";
import { recomputeSchoolRisk } from "@/lib/risk/score";

// Беру температурасы нормада: сорпа мен ыстық сусын ≥75 °C, екінші тағам ≥65 °C, суық тағам ≤14 °C.
const SERVE_C: Record<DishCategory, number> = { SOUP: 78, HOT_DRINK: 77, MAIN: 70, COLD: 12 };

// 1-қадам: жаттығу нысанының асханасы бүгінгі мәзірді СЭС бекіткен жоспардан толтырады, қалыпты
// температуралар мен порция фотолары жазылады. Ортақ ет партиясы (К-2417) техкартасы сай тағамға байланады.
export async function POST() {
  const school = await getTrainingSchool();
  const [batch, existing, plan] = await Promise.all([
    getSharedBatch(school.id),
    prisma.menuItem.count({ where: { schoolId: school.id, date: todayDate() } }),
    prisma.menuPlanItem.findMany({ where: { kind: school.kind, day: planDay() }, orderBy: { category: "asc" } }),
  ]);
  if (existing > 0) {
    return NextResponse.json({ error: "Бүгінгі мәзір бұрыннан бар. Алдымен бастапқы күйге қайтарыңыз." }, { status: 400 });
  }

  // ДБ алыс болғанда әр сұраныс секундқа созылады, сондықтан жазбалар екі createMany-мен жасалады.
  const menuItems = plan.map((p) => ({
    id: randomUUID(),
    schoolId: school.id,
    date: todayDate(),
    name: p.name,
    category: p.category,
    standardPortionG: p.portionG,
    planItemId: p.id,
    batchId: batch && ingredientMatches(p.mainIngredient, batch.product) ? batch.id : null,
  }));
  await prisma.menuItem.createMany({ data: menuItems });
  await prisma.kitchenLog.createMany({
    data: menuItems.flatMap((m) => [
      { schoolId: school.id, menuItemId: m.id, type: "PHOTO" as const, photoUrl: "https://placehold.co/400x300?text=Portion", createdById: "training" },
      { schoolId: school.id, menuItemId: m.id, type: "FRIDGE_TEMP" as const, valueC: 4, isViolation: false, createdById: "training" },
      { schoolId: school.id, menuItemId: m.id, type: "HOT_TEMP" as const, valueC: SERVE_C[m.category], isViolation: false, createdById: "training" },
    ]),
  });

  const { level } = await recomputeSchoolRisk(school.id);

  return NextResponse.json({ menuItems, riskLevel: level });
}
