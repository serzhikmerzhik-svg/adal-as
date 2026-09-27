import type { Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/dict";
import { CLUSTER } from "@/lib/risk/config";

type AlertLike = { reason: string; rule?: string | null; details?: unknown };

/**
 * Алерт мәтіні интерфейс тілінде. Ереже алерттері (тоңазытқыш, мәзір, техкарта, жеу индексі) мен
 * улану кластері details бойынша қайта құрастырылады; басқалары сақталған қазақша мәтінмен қалады
 * (қазақ тілінде ол толығырақ), ал басқа тілде — қысқа аудармасы.
 */
export function alertText(alert: AlertLike, t: Dict, locale: Locale, sourceName?: (schoolId: string) => string | null): string {
  const d = (alert.details && typeof alert.details === "object" ? alert.details : {}) as Record<string, unknown>;
  const str = (key: string) => (typeof d[key] === "string" ? (d[key] as string) : "");
  const num = (key: string) => (typeof d[key] === "number" ? (d[key] as number) : 0);

  switch (alert.rule) {
    case "FRIDGE":
      return t.rules.fridge(str("label"), num("peakC"));
    case "OFF_PLAN":
      return t.rules.offPlan(str("dish"), str("note"));
    case "INGREDIENT":
      return t.rules.ingredient(str("dish"), str("expected"), str("actual"), str("batchCode"));
    case "EATABILITY":
      return t.rules.eatability(str("dish"), num("eatPct"));
  }
  if (locale === "kk") return alert.reason;
  if (Array.isArray(d.reportIds)) return t.alertText.cluster(d.reportIds.length, CLUSTER.WINDOW_MIN);
  if (str("sourceSchoolId") && str("batchCode")) {
    return t.alertText.traced(str("batchCode"), sourceName?.(str("sourceSchoolId")) ?? "—");
  }
  if (typeof d.score === "number") return t.alertText.riskReached(d.score, "");
  return alert.reason;
}
