import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { planDay, PLAN_DAYS } from "@/lib/plan";

// Екі апталық мәзір жоспары (мектеп пен балабақша) және бүгін жоспардың қай күні.
export async function GET() {
  const items = await prisma.menuPlanItem.findMany({
    orderBy: [{ kind: "asc" }, { day: "asc" }, { category: "asc" }],
    select: { id: true, kind: true, day: true, name: true, category: true, portionG: true, mainIngredient: true, composition: true, approvedAt: true },
  });
  return NextResponse.json({ items, today: planDay(), days: PLAN_DAYS });
}
