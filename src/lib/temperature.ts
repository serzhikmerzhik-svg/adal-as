import type { DishCategory } from "@prisma/client";
import { SERVE_NORM, TEMP } from "@/lib/risk/config";

export type TempKind = "FRIDGE_TEMP" | "HOT_TEMP";

/** Тағам санатына қарай беру нормасы: сорпа ≥75 °C, екінші тағам ≥65 °C, суық тағам ≤14 °C. */
export const serveNorm = (category: DishCategory) => SERVE_NORM[category];

/** Температура нормадан тыс па: тоңазытқыш 2–6 °C, тағам — санатының нормасы бойынша. */
export function isTempViolation(type: TempKind, valueC: number, category: DishCategory = "MAIN") {
  if (type === "FRIDGE_TEMP") return valueC < TEMP.FRIDGE_MIN || valueC > TEMP.FRIDGE_MAX;
  const norm = SERVE_NORM[category];
  return (norm.min !== undefined && valueC < norm.min) || (norm.max !== undefined && valueC > norm.max);
}
