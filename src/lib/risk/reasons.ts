import type { Dict } from "@/i18n/dict";
import { RISK_WEIGHTS } from "./config";

type AlertInfo = { level: string; batchCode: string | null; rule?: string | null };

/**
 * Инспекторға түсінікті «негізгі себеп» мәтіні (таңдалған тілде): алдымен ашық алерттер (улану кластері,
 * автоматты ережелер, партия), содан кейін тәуекел балының ең үлкен құрамдас бөліктері.
 */
export function riskReasons(components: Record<string, number> | undefined, alerts: AlertInfo[], t: Pick<Dict, "reasons" | "rules">): string[] {
  const r = t.reasons;
  const reasons: string[] = [];

  const red = alerts.find((a) => a.level === "RED" && !a.rule);
  if (red) reasons.push(red.batchCode ? r.clusterBatch(red.batchCode) : r.cluster);
  // Автоматты ережелер: қызыл (тоңазытқыш) бірінші.
  alerts
    .filter((a) => a.rule && t.rules.names[a.rule])
    .sort((a, b) => (a.level === "RED" ? 0 : 1) - (b.level === "RED" ? 0 : 1))
    .forEach((a) => {
      const name = t.rules.names[a.rule!];
      if (!reasons.includes(name)) reasons.push(name);
    });
  const traced = alerts.find((a) => a.level === "YELLOW" && a.batchCode && !a.rule);
  if (traced) reasons.push(r.tracedBatch(traced.batchCode!));

  if (components && !("seed" in components)) {
    // Балл шегіне жеткенде нақты сан белгісіз, сондықтан "5+" деп жазылады.
    const count = (points: number, per: number, max: number) => `${Math.round(points / per)}${points >= max ? "+" : ""}`;
    const temp = components.tempViolations ?? 0;
    const photos = components.missingPhotos ?? 0;
    const phrases: [number, string][] = [
      [temp, r.temp(count(temp, RISK_WEIGHTS.TEMP_VIOLATION_POINTS, RISK_WEIGHTS.TEMP_VIOLATION_MAX))],
      [photos, r.photos(count(photos, RISK_WEIGHTS.MISSING_PHOTO_POINTS, RISK_WEIGHTS.MISSING_PHOTO_MAX))],
      [components.parentRating ?? 0, r.rating],
      [components.complaintSpike ?? 0, r.complaints],
      [components.supplierRisk ?? 0, r.supplier],
      [components.overduePrescriptions ?? 0, r.overdue],
      [components.inspectionAge ?? 0, r.inspectionOld],
    ];
    phrases
      .filter(([points]) => points > 0)
      .sort((a, b) => b[0] - a[0])
      .forEach(([, text]) => reasons.push(text));
  }

  return reasons.slice(0, 2);
}
