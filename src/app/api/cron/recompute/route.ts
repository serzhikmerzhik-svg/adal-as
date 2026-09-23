import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { recomputeSchoolRisk } from "@/lib/risk/score";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Рұқсат жоқ" }, { status: 401 });
  }

  const schools = await prisma.school.findMany({ select: { id: true } });
  for (const school of schools) {
    await recomputeSchoolRisk(school.id);
  }

  const overduePrescriptions = await prisma.prescription.findMany({
    where: { status: "OPEN", dueAt: { lt: new Date() } },
  });

  return NextResponse.json({ recomputed: schools.length, overduePrescriptions: overduePrescriptions.length });
}
