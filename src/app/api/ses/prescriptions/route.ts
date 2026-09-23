import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

const bodySchema = z.object({
  schoolId: z.string(),
  alertId: z.string().optional(),
  text: z.string().min(1),
  dueAt: z.string(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "SES") return NextResponse.json({ error: "Рұқсат жоқ" }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Дұрыс емес деректер" }, { status: 400 });

  const prescription = await prisma.prescription.create({
    data: {
      schoolId: parsed.data.schoolId,
      alertId: parsed.data.alertId,
      text: parsed.data.text,
      dueAt: new Date(parsed.data.dueAt),
    },
  });

  return NextResponse.json({ prescription });
}
