// Порция фотосын тексерудің ортақ бөлігі (клиент пен сервер): себеп кодтары, олардың қазақша
// атаулары және ИИ жауабын талдау. Сервердегі шақыру — src/lib/photo/check.ts.

export const PHOTO_ISSUE_LABEL = {
  NOT_FOOD: "Фотода тағам жоқ",
  NO_PORTION: "Порция көрінбейді",
  PORTION_SMALL: "Порция нормадан аз",
  DISH_MISMATCH: "Мәзірдегі тағам емес",
  BLURRY: "Фото анық емес",
  SCREEN_OR_STOCK: "Экраннан не интернеттен алынған",
  HYGIENE: "Гигиена бойынша күмән",
  SPOILED: "Тағам сапасы күмәнді",
  DUPLICATE: "Бұл фото бұрын жүктелген",
} as const;

export type PhotoIssue = keyof typeof PHOTO_ISSUE_LABEL;

/** Бұдан аз порция күмәнді саналады (стандарттың пайызы). */
export const PORTION_MIN_PCT = 80;

const ISSUE_CODES = new Set(Object.keys(PHOTO_ISSUE_LABEL));

export type ModelVerdict = { issues: PhotoIssue[]; portionPct: number | null; note: string | null };

/**
 * Модель жауабын JSON ретінде талдайды. Кейбір модельдер JSON-ды ```json блогына орайды немесе
 * алдына сөйлем қосады, сондықтан бірінші { ... } бөлігі алынады. Белгісіз кодтар алынып тасталады.
 */
export function parseModelVerdict(raw: string): ModelVerdict {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("ИИ жауабында JSON жоқ");
  const data = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;

  const issues = new Set<PhotoIssue>(
    (Array.isArray(data.issues) ? data.issues : [])
      .map((i) => String(i).trim().toUpperCase())
      .filter((i): i is PhotoIssue => ISSUE_CODES.has(i)),
  );
  if (data.is_food === false) issues.add("NOT_FOOD");
  if (data.dish_matches === false) issues.add("DISH_MISMATCH");

  const pct = typeof data.portion_pct === "number" && Number.isFinite(data.portion_pct) ? Math.round(data.portion_pct) : null;
  const portionPct = pct === null ? null : Math.max(0, Math.min(200, pct));
  if (portionPct !== null && portionPct < PORTION_MIN_PCT) issues.add("PORTION_SMALL");

  const note = typeof data.note === "string" && data.note.trim() ? data.note.trim().slice(0, 300) : null;
  return { issues: Array.from(issues), portionPct, note };
}

export function issueLabels(issues: string[]) {
  return issues.map((i) => PHOTO_ISSUE_LABEL[i as PhotoIssue] ?? i);
}
