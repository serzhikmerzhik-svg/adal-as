import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const schools = await prisma.school.findMany({
    orderBy: [{ riskScore: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      kind: true,
      rubric: true,
      address: true,
      riskScore: true,
      riskLevel: true,
      lastInspectionAt: true,
      district: { select: { name: true } },
    },
  });
  return NextResponse.json({ schools });
}
