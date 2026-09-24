import { RISK_WEIGHTS } from "./config";

type AlertInfo = { level: string; batchCode: string | null };

/**
 * Инспекторға түсінікті «негізгі себеп» мәтіні: алдымен ашық алерттер (улану кластері,
 * партия), содан кейін тәуекел балының ең үлкен құрамдас бөліктері.
 */
export function riskReasons(components: Record<string, number> | undefined, alerts: AlertInfo[]): string[] {
  const reasons: string[] = [];

  const red = alerts.find((a) => a.level === "RED");
  if (red) reasons.push(red.batchCode ? `Улану кластері · партия ${red.batchCode}` : "Улану кластері");
  const traced = alerts.find((a) => a.level === "YELLOW" && a.batchCode);
  if (traced) reasons.push(`Партия ${traced.batchCode} алған`);

  if (components && !("seed" in components)) {
    // Балл шегіне жеткенде нақты сан белгісіз, сондықтан "5+" деп жазылады.
    const count = (points: number, per: number, max: number) => `${Math.round(points / per)}${points >= max ? "+" : ""}`;
    const temp = components.tempViolations ?? 0;
    const photos = components.missingPhotos ?? 0;
    const phrases: [number, string][] = [
      [temp, `${count(temp, RISK_WEIGHTS.TEMP_VIOLATION_POINTS, RISK_WEIGHTS.TEMP_VIOLATION_MAX)} температура бұзушылығы (14 күн)`],
      [photos, `${count(photos, RISK_WEIGHTS.MISSING_PHOTO_POINTS, RISK_WEIGHTS.MISSING_PHOTO_MAX)} күн фото жоқ`],
      [components.parentRating ?? 0, "Ата-ана/келуші бағасы төмен"],
      [components.complaintSpike ?? 0, "Шағымдар күрт өсті"],
      [components.supplierRisk ?? 0, "Жеткізуші тәуекелі"],
      [components.overduePrescriptions ?? 0, "Нұсқама мерзімі өтті"],
      [components.inspectionAge ?? 0, "Тексеру ескірген"],
    ];
    phrases
      .filter(([points]) => points > 0)
      .sort((a, b) => b[0] - a[0])
      .forEach(([, text]) => reasons.push(text));
  }

  return reasons.slice(0, 2);
}
