// Интерфейс тілдері. Таңдалған тіл "lang" cookie-де сақталады, әдепкісі — қазақша.
export const LOCALES = ["kk", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "kk";
export const LOCALE_COOKIE = "lang";

/** Ауыстырғыштағы қысқа атау және толық атау (экран оқу бағдарламасы үшін). */
export const LOCALE_SHORT: Record<Locale, string> = { kk: "Қаз", ru: "Рус", en: "Eng" };
export const LOCALE_NAME: Record<Locale, string> = { kk: "Қазақша", ru: "Русский", en: "English" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
