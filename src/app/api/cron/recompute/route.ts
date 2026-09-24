import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { recomputeSchoolRisk } from "@/lib/risk/score";
import { mapLimit } from "@/lib/concurrency";

// 500+ нысан: параллель (10-нан) есептеледі, әйтпесе функция уақыт шегіне жетуі мүмкін.
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Рұқсат жоқ" }, { status: 401 });
  }

  const schools = await prisma.school.findMany({ select: { id: true } });
  const started = Date.now();
  await mapLimit(schools, 10, (s) => recomputeSchoolRisk(s.id));

  const overduePrescriptions = await prisma.prescription.count({
    where: { status: "OPEN", dueAt: { lt: new Date() } },
  });

  return NextResponse.json({ recomputed: schools.length, seconds: Math.round((Date.now() - started) / 1000), overduePrescriptions });
}
