import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { todayDate } from "@/lib/date";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const school = await prisma.school.findUnique({ where: { parentToken: token } });
  if (!school) return NextResponse.json({ error: "Мектеп табылмады" }, { status: 404 });

  const menuItems = await prisma.menuItem.findMany({
    where: { schoolId: school.id, date: todayDate() },
    include: { logs: { where: { type: "PHOTO" }, orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    schoolName: school.name,
    menuItems: menuItems.map((m) => ({
      id: m.id,
      name: m.name,
      standardPortionG: m.standardPortionG,
      photoUrl: m.logs[0]?.photoUrl ?? null,
    })),
  });
}
