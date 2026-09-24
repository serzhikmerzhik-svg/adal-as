import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const RECENT_DAYS = 30;
const CERT_WARN_DAYS = 30;

// Бір жеткізуші бірнеше нысанға — бір тәуекел бірнеше нысанға.
export async function GET() {
  const since = new Date();
  since.setDate(since.getDate() - RECENT_DAYS);

  const [suppliers, redAlerts] = await Promise.all([
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      include: {
        batches: {
          orderBy: { producedAt: "desc" },
          include: { deliveries: { where: { deliveredAt: { gte: since } }, select: { schoolId: true } } },
        },
      },
    }),
    prisma.alert.findMany({
      where: { level: "RED", createdAt: { gte: since }, relatedBatchId: { not: null } },
      select: { relatedBatchId: true },
    }),
  ]);
  const redBatchIds = new Set(redAlerts.map((a) => a.relatedBatchId));

  const rows = suppliers.map((s) => {
    const certDaysLeft = Math.ceil((s.certificateValidUntil.getTime() - Date.now()) / 86_400_000);
    const linkedToRed = s.batches.some((b) => redBatchIds.has(b.id));
    const facilities = new Set(s.batches.flatMap((b) => b.deliveries.map((d) => d.schoolId)));
    const products = Array.from(new Set(s.batches.map((b) => b.product))).slice(0, 2);

    let status: "RED" | "YELLOW" | "GREEN" = "GREEN";
    let note = "";
    if (s.blocked) [status, note] = ["RED", "бұғатталған"];
    else if (linkedToRed) [status, note] = ["RED", "кластермен байланысты"];
    else if (certDaysLeft < 0) [status, note] = ["RED", "сертификат мерзімі өтті"];
    else if (certDaysLeft <= CERT_WARN_DAYS) [status, note] = ["YELLOW", "сертификат аяқталуда"];

    return {
      id: s.id,
      name: s.name,
      bin: s.bin,
      blocked: s.blocked,
      certificateValidUntil: s.certificateValidUntil,
      certDaysLeft,
      products,
      facilities: facilities.size,
      status,
      note,
      batches: s.batches.map((b) => ({
        id: b.id,
        code: b.code,
        product: b.product,
        producedAt: b.producedAt,
        expiresAt: b.expiresAt,
        facilities: new Set(b.deliveries.map((d) => d.schoolId)).size,
        linkedToRed: redBatchIds.has(b.id),
      })),
    };
  });

  const order = { RED: 0, YELLOW: 1, GREEN: 2 };
  rows.sort((a, b) => order[a.status] - order[b.status] || b.facilities - a.facilities);

  return NextResponse.json({ suppliers: rows });
}
