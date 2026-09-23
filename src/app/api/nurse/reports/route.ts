import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { checkClusterAndAlert } from "@/lib/alerts/cluster";

const SYMPTOMS = ["NAUSEA", "VOMITING", "DIARRHEA", "FEVER", "ABDOMINAL_PAIN", "OTHER"] as const;

const bodySchema = z.object({
  grade: z.string().min(1),
  symptoms: z.array(z.enum(SYMPTOMS)).min(1),
  reportedAt: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: "Мектеп табылмады" }, { status: 400 });

  const since = new Date();
  since.setHours(since.getHours() - 24);

  const reports = await prisma.symptomReport.findMany({
    where: { schoolId: session.schoolId, reportedAt: { gte: since } },
    orderBy: { reportedAt: "desc" },
  });

  return NextResponse.json({ reports });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: "Мектеп табылмады" }, { status: 400 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Дұрыс емес деректер" }, { status: 400 });

  const report = await prisma.symptomReport.create({
    data: {
      schoolId: session.schoolId,
      grade: parsed.data.grade,
      symptoms: parsed.data.symptoms,
      reportedAt: parsed.data.reportedAt ? new Date(parsed.data.reportedAt) : new Date(),
      createdById: session.userId,
    },
  });

  const alert = await checkClusterAndAlert(session.schoolId);

  return NextResponse.json({ report, alertCreated: !!alert });
}
