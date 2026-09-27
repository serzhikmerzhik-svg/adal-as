import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getTrainingSchool, getSharedBatch } from "@/lib/training";
import { todayDate } from "@/lib/date";
import { recomputeSchoolRisk } from "@/lib/risk/score";

// 1-қадам: жаттығу нысанының асханасына бүгінгі мәзір мен қалыпты температуралар жазылады.
export async function POST() {
  const school = await getTrainingSchool();
  const [batch, existing] = await Promise.all([
    getSharedBatch(school.id),
    prisma.menuItem.count({ where: { schoolId: school.id, date: todayDate() } }),
  ]);
  if (existing > 0) {
    return NextResponse.json({ error: "Бүгінгі мәзір бұрыннан бар. Алдымен бастапқы күйге қайтарыңыз." }, { status: 400 });
  }

  // ДБ алыс болғанда әр сұраныс секундқа созылады, сондықтан жазбалар екі createMany-мен жасалады.
  const menuItems = [
    { name: "Ет котлеті", portion: 200 },
    { name: "Көже", portion: 250 },
  ].map((item) => ({
    id: randomUUID(),
    schoolId: school.id,
    date: todayDate(),
    name: item.name,
    standardPortionG: item.portion,
    batchId: batch?.id ?? null,
  }));
  await prisma.menuItem.createMany({ data: menuItems });
  await prisma.kitchenLog.createMany({
    data: menuItems.flatMap((m) => [
      { schoolId: school.id, menuItemId: m.id, type: "PHOTO" as const, photoUrl: "https://placehold.co/400x300?text=Portion", createdById: "training" },
      { schoolId: school.id, menuItemId: m.id, type: "FRIDGE_TEMP" as const, valueC: 4, isViolation: false, createdById: "training" },
      { schoolId: school.id, menuItemId: m.id, type: "HOT_TEMP" as const, valueC: 72, isViolation: false, createdById: "training" },
    ]),
  });

  const { level } = await recomputeSchoolRisk(school.id);

  return NextResponse.json({ menuItems, riskLevel: level });
}
