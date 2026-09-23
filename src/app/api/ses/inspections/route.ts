import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { recomputeSchoolRisk } from "@/lib/risk/score";

const bodySchema = z.object({
  schoolId: z.string(),
  type: z.enum(["MONITORING", "UNANNOUNCED", "UNSCHEDULED"]),
  plannedAt: z.string(),
  doneAt: z.string().optional(),
  result: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "SES") return NextResponse.json({ error: "Рұқсат жоқ" }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Дұрыс емес деректер" }, { status: 400 });
  const { schoolId, type, plannedAt, doneAt, result } = parsed.data;

  const inspection = await prisma.inspection.create({
    data: {
      schoolId,
      inspectorId: session.userId,
      type,
      plannedAt: new Date(plannedAt),
      doneAt: doneAt ? new Date(doneAt) : null,
      result,
    },
  });

  if (doneAt) {
    await prisma.school.update({ where: { id: schoolId }, data: { lastInspectionAt: new Date(doneAt) } });
    await recomputeSchoolRisk(schoolId);
  }

  return NextResponse.json({ inspection });
}
