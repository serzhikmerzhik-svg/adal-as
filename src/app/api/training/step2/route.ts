import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getTrainingSchool } from "@/lib/training";
import { checkClusterAndAlert } from "@/lib/alerts/cluster";
import { shortName } from "@/lib/format";

// 2-қадам: 10 минут ішінде 4 оқушыда ішек-қарын белгілері тіркеледі — қызыл дабыл іске қосылады.
export async function POST() {
  const school = await getTrainingSchool();
  const grades = ["5А", "5А", "5Ә", "6Б"];
  const names = ["Айсұлу Н.", "Ерасыл Қ.", "Томирис Б.", "Нұрдәулет С."];
  const now = Date.now();

  for (let i = 0; i < grades.length; i++) {
    await prisma.symptomReport.create({
      data: {
        schoolId: school.id,
        studentName: names[i],
        grade: grades[i],
        symptoms: i % 2 === 0 ? ["NAUSEA", "ABDOMINAL_PAIN"] : ["VOMITING", "DIARRHEA"],
        reportedAt: new Date(now - (grades.length - i) * 2 * 60 * 1000),
        createdById: "training",
      },
    });
  }

  const alert = await checkClusterAndAlert(school.id);
  // Партия бойынша сарыға көтерілген нысандар (жаттығу бетінде көрсетіледі).
  const traced = alert
    ? await prisma.alert.findMany({
        where: { level: "YELLOW", details: { path: ["sourceAlertId"], equals: alert.id } },
        select: { school: { select: { name: true, kind: true } } },
      })
    : [];

  return NextResponse.json({
    alertCreated: !!alert,
    alertId: alert?.id ?? null,
    traced: traced.map((t) => shortName(t.school.name, t.school.kind)),
  });
}
