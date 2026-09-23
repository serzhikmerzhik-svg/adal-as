import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { recomputeSchoolRisk } from "@/lib/risk/score";

const kitchenSchema = z.object({ action: z.literal("submit"), evidencePhotoUrl: z.string().min(1) });
const sesSchema = z.object({ action: z.enum(["accept", "reject"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Рұқсат жоқ" }, { status: 401 });

  const prescription = await prisma.prescription.findUnique({ where: { id } });
  if (!prescription) return NextResponse.json({ error: "Нұсқама табылмады" }, { status: 404 });

  const raw = await request.json();

  if (session.role === "KITCHEN") {
    if (prescription.schoolId !== session.schoolId) {
      return NextResponse.json({ error: "Рұқсат жоқ" }, { status: 403 });
    }
    const parsed = kitchenSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Дұрыс емес деректер" }, { status: 400 });

    const updated = await prisma.prescription.update({
      where: { id },
      data: {
        status: "SUBMITTED",
        evidencePhotoUrl: parsed.data.evidencePhotoUrl,
        submittedAt: new Date(),
      },
    });
    return NextResponse.json({ prescription: updated });
  }

  if (session.role === "SES") {
    const parsed = sesSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Дұрыс емес деректер" }, { status: 400 });

    const updated = await prisma.prescription.update({
      where: { id },
      data: {
        status: parsed.data.action === "accept" ? "ACCEPTED" : "REJECTED",
        decidedAt: new Date(),
      },
    });
    await recomputeSchoolRisk(prescription.schoolId);
    return NextResponse.json({ prescription: updated });
  }

  return NextResponse.json({ error: "Рұқсат жоқ" }, { status: 403 });
}
