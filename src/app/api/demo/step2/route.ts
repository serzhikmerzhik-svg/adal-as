import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getDemoSchool } from "@/lib/demo";
import { checkClusterAndAlert } from "@/lib/alerts/cluster";

// 2-қадам: 10 минут ішінде 4 оқушыда ішек-қарын белгілері тіркеледі — қызыл дабыл іске қосылады.
export async function POST() {
  const school = await getDemoSchool();
  const grades = ["5А", "5А", "5Ә", "6Б"];
  const now = Date.now();

  for (let i = 0; i < grades.length; i++) {
    await prisma.symptomReport.create({
      data: {
        schoolId: school.id,
        grade: grades[i],
        symptoms: i % 2 === 0 ? ["NAUSEA", "ABDOMINAL_PAIN"] : ["VOMITING", "DIARRHEA"],
        reportedAt: new Date(now - (grades.length - i) * 2 * 60 * 1000),
        createdById: "demo",
      },
    });
  }

  const alert = await checkClusterAndAlert(school.id);

  return NextResponse.json({ alertCreated: !!alert, alertId: alert?.id ?? null });
}
