// Порция фотосын тексерудің ортақ бөлігі (клиент пен сервер): себеп кодтары және ИИ жауабын талдау.
// Кодтардың атаулары сөздікте (t.photoIssues). Сервердегі шақыру — src/lib/photo/check.ts.

export const PHOTO_ISSUES = [
  "NOT_FOOD",
  "NO_PORTION",
  "PORTION_SMALL",
  "DISH_MISMATCH",
  "BLURRY",
  "SCREEN_OR_STOCK",
  "HYGIENE",
  "SPOILED",
  "DUPLICATE",
] as const;

export type PhotoIssue = (typeof PHOTO_ISSUES)[number];

/** Бұдан аз порция күмәнді саналады (стандарттың пайызы). */
export const PORTION_MIN_PCT = 80;

const ISSUE_CODES = new Set<string>(PHOTO_ISSUES);

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

/** Себеп кодтарын таңдалған тілдің атауларымен (t.photoIssues) ауыстырады. */
export function issueLabels(issues: string[], labels: Record<string, string>) {
  return issues.map((i) => labels[i] ?? i);
}
