import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSharedBatch, getTrainingSchool } from "@/lib/training";
import { shortName } from "@/lib/format";

// Жаттығу бетінің мәтіндері үшін: сценарий нысаны, оның бүгінгі ортақ партиясы және сол партияны алған нысандар.
export async function GET() {
  const school = await getTrainingSchool();
  const batch = await getSharedBatch(school.id);
  const recipients = batch
    ? await prisma.delivery.findMany({
        where: { batchId: batch.id, schoolId: { not: school.id } },
        distinct: ["schoolId"],
        select: { school: { select: { name: true, kind: true } } },
      })
    : [];

  return NextResponse.json({
    school: shortName(school.name, school.kind),
    batch: batch ? { code: batch.code, product: batch.product } : null,
    recipients: recipients.map((r) => shortName(r.school.name, r.school.kind)),
  });
}
