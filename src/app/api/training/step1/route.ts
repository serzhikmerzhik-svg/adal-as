import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getTrainingSchool, getSharedBatch } from "@/lib/training";
import { todayDate } from "@/lib/date";
import { recomputeSchoolRisk } from "@/lib/risk/score";

// 1-қадам: А-12 асханасына бүгінгі мәзір мен қалыпты температуралар жазылады.
export async function POST() {
  const school = await getTrainingSchool();
  const batch = await getSharedBatch(school.id);

  const existing = await prisma.menuItem.findMany({ where: { schoolId: school.id, date: todayDate() } });
  if (existing.length > 0) {
    return NextResponse.json({ error: "Бүгінгі мәзір бұрыннан бар. Алдымен бастапқы күйге қайтарыңыз." }, { status: 400 });
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
      data: { schoolId: school.id, menuItemId: menuItem.id, type: "PHOTO", photoUrl: "https://placehold.co/400x300?text=Portion", createdById: "training" },
    });
    await prisma.kitchenLog.create({
      data: { schoolId: school.id, menuItemId: menuItem.id, type: "FRIDGE_TEMP", valueC: 4, isViolation: false, createdById: "training" },
    });
    await prisma.kitchenLog.create({
      data: { schoolId: school.id, menuItemId: menuItem.id, type: "HOT_TEMP", valueC: 72, isViolation: false, createdById: "training" },
    });
    created.push(menuItem);
  }

  const { level } = await recomputeSchoolRisk(school.id);

  return NextResponse.json({ menuItems: created, riskLevel: level });
}
