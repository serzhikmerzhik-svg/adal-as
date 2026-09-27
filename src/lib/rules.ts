import { prisma } from "@/lib/db/prisma";
import { DEVICE, EATABILITY, TEMP } from "@/lib/risk/config";
import { ingredientMatches } from "@/lib/plan";
import { recomputeSchoolRisk } from "@/lib/risk/score";

// Автоматты ережелер: тәуекел балынан бөлек, бірден алерт береді. Ашық ереже алерті нысанды кемінде
// сары етеді (FRIDGE — қызыл). Мәтін қазақша сақталады, интерфейс оны details бойынша аударады.

export type Rule = "FRIDGE" | "OFF_PLAN" | "INGREDIENT" | "EATABILITY";

/** Бір нысанда бір кілт (құрылғы, тағам) бойынша бір ғана ашық алерт. Жаңасы жасалса, оны қайтарады. */
async function raise(
  schoolId: string,
  rule: Rule,
  level: "RED" | "YELLOW",
  reason: string,
  details: Record<string, string | number | null> & { key: string },
) {
  const existing = await prisma.alert.findFirst({
    where: { schoolId, rule, status: { in: ["OPEN", "ACKNOWLEDGED"] }, details: { path: ["key"], equals: details.key } },
    select: { id: true },
  });
  if (existing) return null;
  return prisma.alert.create({ data: { schoolId, rule, level, reason, details } });
}

/**
 * Тоңазытқыш датчигі: соңғы FRIDGE_CONSECUTIVE өлшем қатарынан нормадан жоғары болса — қызыл алерт.
 * Түнде бұзылса да СЭС пен асхана таңертең емес, бірден көреді.
 */
export async function checkFridgeDevice(deviceId: string) {
  const device = await prisma.device.findUniqueOrThrow({ where: { id: deviceId }, select: { id: true, schoolId: true, label: true } });
  const last = await prisma.deviceReading.findMany({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
    take: DEVICE.FRIDGE_CONSECUTIVE,
    select: { value: true, createdAt: true },
  });
  if (last.length < DEVICE.FRIDGE_CONSECUTIVE || !last.every((r) => r.value > TEMP.FRIDGE_MAX)) return null;

  const peak = Math.max(...last.map((r) => r.value));
  const since = last[last.length - 1].createdAt;
  const alert = await raise(
    device.schoolId,
    "FRIDGE",
    "RED",
    `«${device.label}» тоңазытқышы: ${peak} °C (норма ${TEMP.FRIDGE_MIN}–${TEMP.FRIDGE_MAX} °C), датчик қатарынан ${last.length} рет тіркеді`,
    { key: device.id, deviceId: device.id, label: device.label, peakC: peak, since: since.toISOString() },
  );
  if (alert) {
    // Тәуекел балы үшін бір бұзушылық жазбасы (әр өлшем үшін емес).
    await prisma.kitchenLog.create({
      data: {
        schoolId: device.schoolId,
        type: "FRIDGE_TEMP",
        valueC: peak,
        isViolation: true,
        source: "DEVICE",
        deviceId: device.id,
        createdById: `device:${device.id}`,
      },
    });
    await recomputeSchoolRisk(device.schoolId);
  }
  return alert;
}

/**
 * Мәзір СЭС бекіткен жоспарға сай ма: жоспардан тыс тағам (себебімен) және партиядағы өнім
 * техкартадағы негізгі өнімге сәйкес келмесе («сиыр етінің» орнына «шұжық») — сары алерт.
 */
export async function checkMenuCompliance(menuItemId: string) {
  const item = await prisma.menuItem.findUniqueOrThrow({
    where: { id: menuItemId },
    include: { planItem: { select: { name: true, mainIngredient: true } }, batch: { select: { code: true, product: true } } },
  });
  const alerts = [];
  if (!item.planItem && item.offPlanReason) {
    alerts.push(
      await raise(item.schoolId, "OFF_PLAN", "YELLOW", `Жоспардан тыс тағам: «${item.name}» — ${item.offPlanReason}`, {
        key: item.id,
        menuItemId: item.id,
        dish: item.name,
        note: item.offPlanReason,
      }),
    );
  }
  if (item.planItem && item.batch && !ingredientMatches(item.planItem.mainIngredient, item.batch.product)) {
    alerts.push(
      await raise(
        item.schoolId,
        "INGREDIENT",
        "YELLOW",
        `«${item.name}»: техкартада «${item.planItem.mainIngredient}», ал партияда «${item.batch.product}» (${item.batch.code})`,
        {
          key: item.id,
          menuItemId: item.id,
          dish: item.name,
          expected: item.planItem.mainIngredient,
          actual: item.batch.product,
          batchCode: item.batch.code,
        },
      ),
    );
  }
  if (alerts.some(Boolean)) await recomputeSchoolRisk(item.schoolId);
  return alerts.filter(Boolean);
}

/** Жеу индексі (100 − табақта қалған үлес) EATABILITY.LOW_PCT-тен төмен болса — сары алерт, сапаны тексеру ұсынылады. */
export async function checkEatability(logId: string) {
  const log = await prisma.kitchenLog.findUnique({
    where: { id: logId },
    select: { schoolId: true, aiWastePct: true, menuItemId: true, menuItem: { select: { name: true } } },
  });
  if (!log || log.aiWastePct === null || !log.menuItemId) return null;
  const eatPct = 100 - log.aiWastePct;
  if (eatPct >= EATABILITY.LOW_PCT) return null;
  const alert = await raise(
    log.schoolId,
    "EATABILITY",
    "YELLOW",
    `«${log.menuItem?.name}»: жеу индексі ${eatPct}% — балалар тағамның көбін жемеген, дайындау технологиясын тексеру ұсынылады`,
    { key: log.menuItemId, menuItemId: log.menuItemId, dish: log.menuItem?.name ?? "", eatPct },
  );
  if (alert) await recomputeSchoolRisk(log.schoolId);
  return alert;
}
