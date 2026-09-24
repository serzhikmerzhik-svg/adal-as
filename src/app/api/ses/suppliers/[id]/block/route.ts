import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { recomputeSchoolRisk } from "@/lib/risk/score";
import { mapLimit } from "@/lib/concurrency";

export const maxDuration = 60;

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role !== "SES") return NextResponse.json({ error: "Рұқсат жоқ" }, { status: 403 });

  const supplier = await prisma.supplier.update({ where: { id }, data: { blocked: true } });

  // Жеткізуші жүздеген нысанға жеткізеді: тәуекелді қайта есептеуді жауаптан кейін, параллель
  // жүргіземіз. Тек supplierRisk қарайтын терезедегі (соңғы 14 күн) жеткізулер ескеріледі.
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const affected = await prisma.delivery.findMany({
    where: { batch: { supplierId: id }, deliveredAt: { gte: since } },
    distinct: ["schoolId"],
    select: { schoolId: true },
  });
  after(() => mapLimit(affected, 10, ({ schoolId }) => recomputeSchoolRisk(schoolId)));

  return NextResponse.json({ supplier, recomputing: affected.length });
}
