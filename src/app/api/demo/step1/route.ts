import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getDemoSchool, getSharedBatch } from "@/lib/demo";
import { todayDate } from "@/lib/date";
import { recomputeSchoolRisk } from "@/lib/risk/score";

// 1-қадам: демо-мектепке бүгінгі мәзір мен қалыпты температуралар жазылады.
export async function POST() {
  const school = await getDemoSchool();
  const batch = await getSharedBatch(school.id);

  const existing = await prisma.menuItem.findMany({ where: { schoolId: school.id, date: todayDate() } });
  if (existing.length > 0) {
    return NextResponse.json({ error: "Бүгінгі мәзір бұрыннан бар. Алдымен демоны қалпына келтіріңіз." }, { status: 400 });
  }

  const items = [
    { name: "Ет котлеті", portion: 200 },
    { name: "Көже", portion: 250 },
  ];

  const created = [];
  for (const item of items) {
    const menuItem = await prisma.menuItem.create({
      data: { schoolId: school.id, date: todayDate(), name: item.name, standardPortionG: item.portion, batchId: batch?.id },
    });
    await prisma.kitchenLog.create({
      data: { schoolId: school.id, menuItemId: menuItem.id, type: "PHOTO", photoUrl: "https://placehold.co/400x300?text=Demo", createdById: "demo" },
    });
    await prisma.kitchenLog.create({
      data: { schoolId: school.id, menuItemId: menuItem.id, type: "FRIDGE_TEMP", valueC: 4, isViolation: false, createdById: "demo" },
    });
    await prisma.kitchenLog.create({
      data: { schoolId: school.id, menuItemId: menuItem.id, type: "HOT_TEMP", valueC: 72, isViolation: false, createdById: "demo" },
    });
    created.push(menuItem);
  }

  const { level } = await recomputeSchoolRisk(school.id);

  return NextResponse.json({ menuItems: created, riskLevel: level });
}
