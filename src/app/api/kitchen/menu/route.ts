import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { todayDate } from "@/lib/date";

const bodySchema = z.object({
  name: z.string().min(1),
  standardPortionG: z.number().optional(),
  batchId: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: "Мектеп табылмады" }, { status: 400 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Дұрыс емес деректер" }, { status: 400 });

  const menuItem = await prisma.menuItem.create({
    data: {
      schoolId: session.schoolId,
      date: todayDate(),
      name: parsed.data.name,
      standardPortionG: parsed.data.standardPortionG,
      batchId: parsed.data.batchId,
    },
  });

  return NextResponse.json({ menuItem });
}
