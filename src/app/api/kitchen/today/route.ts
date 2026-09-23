import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { todayRange } from "@/lib/date";

export async function GET() {
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: "Мектеп табылмады" }, { status: 400 });

  const { start, end } = todayRange();
  const [menuItems, prescriptions, suppliers] = await Promise.all([
    prisma.menuItem.findMany({
      where: { schoolId: session.schoolId, date: { gte: start, lte: end } },
      include: {
        batch: { include: { supplier: true } },
        logs: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.prescription.findMany({
      where: { schoolId: session.schoolId, status: { in: ["OPEN", "SUBMITTED"] } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({ menuItems, prescriptions, suppliers });
}
