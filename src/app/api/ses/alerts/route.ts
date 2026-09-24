import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      level: true,
      reason: true,
      status: true,
      createdAt: true,
      relatedBatchId: true,
      details: true,
      school: { select: { id: true, name: true, kind: true, address: true, district: { select: { name: true } } } },
    },
  });

  const tracedCount = (redId: string) =>
    alerts.filter((a) => (a.details as { sourceAlertId?: string } | null)?.sourceAlertId === redId).length;

  return NextResponse.json({
    alerts: alerts.map(({ details, ...a }) => ({
      ...a,
      batchCode: (details as { batchCode?: string } | null)?.batchCode ?? null,
      tracedCount: a.level === "RED" ? tracedCount(a.id) : 0,
    })),
  });
}
