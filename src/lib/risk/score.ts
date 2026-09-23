import { prisma } from "@/lib/db/prisma";
import { RiskLevel } from "@prisma/client";
import { RISK_THRESHOLDS, RISK_WEIGHTS } from "./config";

export type RiskComponents = {
  tempViolations: number;
  missingPhotos: number;
  parentRating: number;
  complaintSpike: number;
  supplierRisk: number;
  inspectionAge: number;
  overduePrescriptions: number;
};

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function tempViolationsScore(schoolId: string) {
  const count = await prisma.kitchenLog.count({
    where: {
      schoolId,
      isViolation: true,
      type: { in: ["FRIDGE_TEMP", "HOT_TEMP"] },
      createdAt: { gte: daysAgo(RISK_WEIGHTS.TEMP_VIOLATION_DAYS) },
    },
  });
  return Math.min(count * RISK_WEIGHTS.TEMP_VIOLATION_POINTS, RISK_WEIGHTS.TEMP_VIOLATION_MAX);
}

async function missingPhotosScore(schoolId: string) {
  const recentMenuDays = await prisma.menuItem.findMany({
    where: { schoolId, date: { lte: new Date() } },
    distinct: ["date"],
    orderBy: { date: "desc" },
    take: RISK_WEIGHTS.MISSING_PHOTO_DAYS,
    select: { date: true },
  });

  let missing = 0;
  for (const { date } of recentMenuDays) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const photoCount = await prisma.kitchenLog.count({
      where: {
        schoolId,
        type: "PHOTO",
        createdAt: { gte: date, lt: nextDay },
      },
    });
    if (photoCount === 0) missing += 1;
  }
  return Math.min(missing * RISK_WEIGHTS.MISSING_PHOTO_POINTS, RISK_WEIGHTS.MISSING_PHOTO_MAX);
}

async function parentRatingScore(schoolId: string) {
  const agg = await prisma.parentFeedback.aggregate({
    where: { schoolId, createdAt: { gte: daysAgo(RISK_WEIGHTS.PARENT_RATING_DAYS) } },
    _avg: { rating: true },
    _count: true,
  });
  if (!agg._count || agg._avg.rating === null) return 0;
  if (agg._avg.rating < 3.0) return RISK_WEIGHTS.PARENT_RATING_LOW;
  if (agg._avg.rating < 3.5) return RISK_WEIGHTS.PARENT_RATING_MID;
  return 0;
}

// "Шағым" ретінде ата-ананың төмен бағасы (rating <= 2) есептеледі.
async function complaintSpikeScore(schoolId: string) {
  const [last3, last14] = await Promise.all([
    prisma.parentFeedback.count({
      where: { schoolId, rating: { lte: 2 }, createdAt: { gte: daysAgo(3) } },
    }),
    prisma.parentFeedback.count({
      where: {
        schoolId,
        rating: { lte: 2 },
        createdAt: { gte: daysAgo(RISK_WEIGHTS.COMPLAINT_SPIKE_BASELINE_DAYS) },
      },
    }),
  ]);
  const dailyAvg = last14 / RISK_WEIGHTS.COMPLAINT_SPIKE_BASELINE_DAYS;
  const expected3Day = dailyAvg * RISK_WEIGHTS.COMPLAINT_SPIKE_DAYS;
  const isSpike =
    last3 >= RISK_WEIGHTS.COMPLAINT_SPIKE_MIN_COUNT &&
    last3 > RISK_WEIGHTS.COMPLAINT_SPIKE_MULTIPLIER * expected3Day;
  return isSpike ? RISK_WEIGHTS.COMPLAINT_SPIKE_MAX : 0;
}

async function supplierRiskScore(schoolId: string) {
  const deliveries = await prisma.delivery.findMany({
    where: { schoolId, deliveredAt: { gte: daysAgo(14) } },
    include: { batch: { include: { supplier: true } } },
  });

  for (const delivery of deliveries) {
    const supplier = delivery.batch.supplier;
    if (supplier.blocked) return RISK_WEIGHTS.SUPPLIER_RISK_MAX;
    if (supplier.certificateValidUntil < new Date()) return RISK_WEIGHTS.SUPPLIER_RISK_MAX;

    const redAlertLinked = await prisma.alert.findFirst({
      where: {
        level: "RED",
        createdAt: { gte: daysAgo(RISK_WEIGHTS.SUPPLIER_RISK_ALERT_DAYS) },
        relatedBatchId: { in: (await prisma.batch.findMany({ where: { supplierId: supplier.id }, select: { id: true } })).map((b) => b.id) },
      },
    });
    if (redAlertLinked) return RISK_WEIGHTS.SUPPLIER_RISK_MAX;
  }
  return 0;
}

function inspectionAgeScore(lastInspectionAt: Date | null) {
  if (!lastInspectionAt) return RISK_WEIGHTS.INSPECTION_AGE_MAX;
  const diffDays = (Date.now() - lastInspectionAt.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > RISK_WEIGHTS.INSPECTION_AGE_STALE_DAYS) return RISK_WEIGHTS.INSPECTION_AGE_MAX;
  if (diffDays > RISK_WEIGHTS.INSPECTION_AGE_WARN_DAYS) return RISK_WEIGHTS.INSPECTION_AGE_WARN_POINTS;
  return 0;
}

async function overduePrescriptionsScore(schoolId: string) {
  const count = await prisma.prescription.count({
    where: { schoolId, status: "OPEN", dueAt: { lt: new Date() } },
  });
  return Math.min(count * RISK_WEIGHTS.OVERDUE_PRESCRIPTION_POINTS, RISK_WEIGHTS.OVERDUE_PRESCRIPTION_MAX);
}

export async function computeRiskComponents(schoolId: string): Promise<RiskComponents> {
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });

  const [tempViolations, missingPhotos, parentRating, complaintSpike, supplierRisk, overduePrescriptions] =
    await Promise.all([
      tempViolationsScore(schoolId),
      missingPhotosScore(schoolId),
      parentRatingScore(schoolId),
      complaintSpikeScore(schoolId),
      supplierRiskScore(schoolId),
      overduePrescriptionsScore(schoolId),
    ]);

  return {
    tempViolations,
    missingPhotos,
    parentRating,
    complaintSpike,
    supplierRisk,
    inspectionAge: inspectionAgeScore(school.lastInspectionAt),
    overduePrescriptions,
  };
}

export function totalScore(components: RiskComponents) {
  return Math.min(
    100,
    Object.values(components).reduce((sum, v) => sum + v, 0),
  );
}

export function levelForScore(score: number, hasOpenRedAlert: boolean): RiskLevel {
  if (hasOpenRedAlert || score >= RISK_THRESHOLDS.RED_MIN) return "RED";
  if (score >= RISK_THRESHOLDS.YELLOW_MIN) return "YELLOW";
  return "GREEN";
}

/** Мектептің тәуекел балын қайта есептеп, RiskSnapshot жазады және School.riskScore/riskLevel жаңартады. */
export async function recomputeSchoolRisk(schoolId: string) {
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
  const components = await computeRiskComponents(schoolId);
  const score = totalScore(components);

  const openRedAlert = await prisma.alert.findFirst({
    where: { schoolId, level: "RED", status: { in: ["OPEN", "ACKNOWLEDGED"] } },
  });

  const level = levelForScore(score, !!openRedAlert);
  const previousLevel = school.riskLevel;

  await prisma.$transaction([
    prisma.riskSnapshot.create({
      data: { schoolId, score, level, components: components as unknown as object },
    }),
    prisma.school.update({ where: { id: schoolId }, data: { riskScore: score, riskLevel: level } }),
  ]);

  // Сары деңгейге алғаш көтерілгенде YELLOW алерт жасалады (қайталанбасын).
  if (level === "YELLOW" && previousLevel === "GREEN") {
    const existingOpenYellow = await prisma.alert.findFirst({
      where: { schoolId, level: "YELLOW", status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    });
    if (!existingOpenYellow) {
      await prisma.alert.create({
        data: {
          schoolId,
          level: "YELLOW",
          reason: "Тәуекел деңгейі сарыға көтерілді",
          details: { score, components } as unknown as object,
        },
      });
    }
  }

  return { score, level, components };
}
