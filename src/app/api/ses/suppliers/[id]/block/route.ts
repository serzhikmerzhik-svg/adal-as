import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { recomputeSchoolRisk } from "@/lib/risk/score";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role !== "SES") return NextResponse.json({ error: "Рұқсат жоқ" }, { status: 403 });

  const supplier = await prisma.supplier.update({ where: { id }, data: { blocked: true } });

  const affectedSchools = await prisma.delivery.findMany({
    where: { batch: { supplierId: id } },
    distinct: ["schoolId"],
    select: { schoolId: true },
  });
  for (const { schoolId } of affectedSchools) {
    await recomputeSchoolRisk(schoolId);
  }

  return NextResponse.json({ supplier });
}
