import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

// Инспектор ИИ күмәнді деп белгілеген фотоны қарап шықты — ол кезектен түседі.
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SES") return NextResponse.json({ error: "Рұқсат жоқ" }, { status: 403 });
  const { id } = await params;

  const log = await prisma.kitchenLog.update({
    where: { id },
    data: { reviewedAt: new Date() },
    select: { id: true, reviewedAt: true },
  });
  return NextResponse.json(log);
}
