import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

// Қарапайым IP бойынша шектеу: бір IP бір мектепке күніне бір рет баға бере алады.
// Есте болсын: жад-ішіндегі шектеу тек бір сервер instance ауқымында жұмыс істейді.
const recentSubmissions = new Map<string, number>();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const school = await prisma.school.findUnique({ where: { parentToken: token } });
  if (!school) return NextResponse.json({ error: "Мектеп табылмады" }, { status: 404 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `${ip}-${school.id}`;
  const last = recentSubmissions.get(key);
  if (last && Date.now() - last < ONE_DAY_MS) {
    return NextResponse.json({ error: "Сіз бүгін баға бердіңіз" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Дұрыс емес деректер" }, { status: 400 });

  await prisma.parentFeedback.create({
    data: { schoolId: school.id, rating: parsed.data.rating, comment: parsed.data.comment },
  });
  recentSubmissions.set(key, Date.now());

  const { recomputeSchoolRisk } = await import("@/lib/risk/score");
  await recomputeSchoolRisk(school.id);

  return NextResponse.json({ ok: true });
}
