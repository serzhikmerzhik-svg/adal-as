import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { todayRange } from "@/lib/date";

// Бүгін асханалар жүктеген порция фотолары және ИИ тексеруінің нәтижесі (СЭС беті 5 с сайын сұрайды).
// Суреттің өзі жіберілмейді: ол /api/ses/photos/[id]/image арқылы жеке жүктеледі.
export async function GET() {
  const { start } = todayRange();
  const where = { type: "PHOTO" as const, createdAt: { gte: start }, aiStatus: { not: null } };

  const [photos, groups, unreviewed] = await Promise.all([
    prisma.kitchenLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        createdAt: true,
        aiStatus: true,
        aiIssues: true,
        aiPortionPct: true,
        aiSummary: true,
        aiModel: true,
        reviewedAt: true,
        menuItem: { select: { name: true, standardPortionG: true } },
        school: { select: { id: true, name: true, kind: true, district: { select: { name: true } } } },
      },
    }),
    prisma.kitchenLog.groupBy({ by: ["aiStatus"], where, _count: true }),
    prisma.kitchenLog.count({ where: { ...where, aiStatus: "FLAGGED", reviewedAt: null } }),
  ]);

  const count = (status: string) => groups.find((g) => g.aiStatus === status)?._count ?? 0;
  return NextResponse.json({
    photos: photos.map((p) => ({ ...p, imageUrl: `/api/ses/photos/${p.id}/image` })),
    counts: {
      total: groups.reduce((sum, g) => sum + g._count, 0),
      pending: count("PENDING"),
      ok: count("OK"),
      flagged: count("FLAGGED"),
      unreviewed,
      aiOff: count("DISABLED") + count("ERROR"),
    },
  });
}
