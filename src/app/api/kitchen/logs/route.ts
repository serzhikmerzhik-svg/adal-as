import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { TEMP } from "@/lib/risk/config";
import { recomputeSchoolRisk } from "@/lib/risk/score";

const bodySchema = z.object({
  menuItemId: z.string().optional(),
  type: z.enum(["PHOTO", "FRIDGE_TEMP", "HOT_TEMP"]),
  valueC: z.number().optional(),
  photoUrl: z.string().optional(),
});

function isViolation(type: "FRIDGE_TEMP" | "HOT_TEMP", valueC: number) {
  if (type === "FRIDGE_TEMP") return valueC < TEMP.FRIDGE_MIN || valueC > TEMP.FRIDGE_MAX;
  return valueC < TEMP.HOT_MIN;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: "Мектеп табылмады" }, { status: 400 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Дұрыс емес деректер" }, { status: 400 });
  const { menuItemId, type, valueC, photoUrl } = parsed.data;

  if (type !== "PHOTO" && valueC === undefined) {
    return NextResponse.json({ error: "Температура мәні қажет" }, { status: 400 });
  }
  if (type === "PHOTO" && !photoUrl) {
    return NextResponse.json({ error: "Фото URL қажет" }, { status: 400 });
  }

  const log = await prisma.kitchenLog.create({
    data: {
      schoolId: session.schoolId,
      menuItemId,
      type,
      valueC: type === "PHOTO" ? null : valueC,
      photoUrl: type === "PHOTO" ? photoUrl : null,
      isViolation: type !== "PHOTO" && valueC !== undefined ? isViolation(type, valueC) : false,
      createdById: session.userId,
    },
  });

  const { level } = await recomputeSchoolRisk(session.schoolId);

  return NextResponse.json({ log, riskLevel: level });
}
