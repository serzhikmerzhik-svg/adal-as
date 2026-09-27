import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { checkClusterAndAlert } from "@/lib/alerts/cluster";
import { getT } from "@/i18n/server";

const SYMPTOMS = ["NAUSEA", "VOMITING", "DIARRHEA", "FEVER", "ABDOMINAL_PAIN", "OTHER"] as const;

// Баланың толық аты-жөні мен сыныбы міндетті; «Басқа» белгі таңдалса, медбике оны сипаттайды.
const bodySchema = z
  .object({
    studentName: z.string().trim().min(3).max(100),
    grade: z.string().trim().min(1).max(10),
    symptoms: z.array(z.enum(SYMPTOMS)).min(1),
    otherNote: z.string().trim().max(200).optional(),
    reportedAt: z.string().optional(),
  })
  .refine((b) => !b.symptoms.includes("OTHER") || (b.otherNote?.length ?? 0) > 0, { path: ["otherNote"] });

/** Медбикеге өз мектебінің соңғы 24 сағаттағы тіркеулері (аты-жөнімен — тек осы бетте). */
export async function GET() {
  const t = await getT();
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: t.api.forbidden }, { status: 400 });

  const since = new Date();
  since.setHours(since.getHours() - 24);

  const reports = await prisma.symptomReport.findMany({
    where: { schoolId: session.schoolId, reportedAt: { gte: since } },
    orderBy: { reportedAt: "desc" },
    select: { id: true, studentName: true, grade: true, symptoms: true, otherNote: true, reportedAt: true },
  });

  return NextResponse.json({ reports });
}

export async function POST(request: Request) {
  const t = await getT();
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: t.api.forbidden }, { status: 400 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const otherMissing = parsed.error.issues.some((i) => i.path[0] === "otherNote");
    return NextResponse.json({ error: otherMissing ? t.nurse.otherRequired : t.nurse.nameRequired }, { status: 400 });
  }
  const { studentName, grade, symptoms, otherNote, reportedAt } = parsed.data;

  const report = await prisma.symptomReport.create({
    data: {
      schoolId: session.schoolId,
      studentName,
      grade: grade.toUpperCase(),
      symptoms,
      otherNote: symptoms.includes("OTHER") ? otherNote : null,
      reportedAt: reportedAt ? new Date(reportedAt) : new Date(),
      createdById: session.userId,
    },
    select: { id: true },
  });

  const alert = await checkClusterAndAlert(session.schoolId);

  return NextResponse.json({ report, alertCreated: !!alert });
}
