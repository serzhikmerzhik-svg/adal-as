import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { recomputeSchoolRisk } from "@/lib/risk/score";

const bodySchema = z.object({
  supplierId: z.string(),
  batchCode: z.string().min(1),
  product: z.string().min(1),
  producedAt: z.string(),
  expiresAt: z.string(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: "Мектеп табылмады" }, { status: 400 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Дұрыс емес деректер" }, { status: 400 });
  const { supplierId, batchCode, product, producedAt, expiresAt } = parsed.data;

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return NextResponse.json({ error: "Жеткізуші табылмады" }, { status: 404 });

  const batch = await prisma.batch.upsert({
    where: { code: batchCode },
    update: {},
    create: {
      code: batchCode,
      product,
      producedAt: new Date(producedAt),
      expiresAt: new Date(expiresAt),
      supplierId,
    },
  });

  const delivery = await prisma.delivery.create({
    data: { batchId: batch.id, schoolId: session.schoolId, deliveredAt: new Date() },
  });

  await recomputeSchoolRisk(session.schoolId);

  return NextResponse.json({ batch, delivery, supplierBlocked: supplier.blocked });
}
