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
 * Модель жауабынан JSON алады. Кейбір модельдер JSON-ды ```json блогына орайды немесе
 * алдына сөйлем қосады, сондықтан бірінші { ... } бөлігі алынады.
 */
function extractJson(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("ИИ жауабында JSON жоқ");
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

/** Белгісіз кодтар алынып тасталады. */
function pickIssues<T extends string>(data: Record<string, unknown>, allowed: ReadonlySet<string>) {
  return new Set<T>(
    (Array.isArray(data.issues) ? data.issues : []).map((i) => String(i).trim().toUpperCase()).filter((i): i is T => allowed.has(i)),
  );
}

const noteOf = (data: Record<string, unknown>) =>
  typeof data.note === "string" && data.note.trim() ? data.note.trim().slice(0, 300) : null;

const pctOf = (value: unknown, max = 100) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : null;

/** Порция фотосы: тағам ба, мәзірге сай ма, порция стандарттың неше пайызы. */
export function parseModelVerdict(raw: string): ModelVerdict {
  const data = extractJson(raw);
  const issues = pickIssues<PhotoIssue>(data, ISSUE_CODES);
  if (data.is_food === false) issues.add("NOT_FOOD");
  if (data.dish_matches === false) issues.add("DISH_MISMATCH");

  const portionPct = pctOf(data.portion_pct, 200);
  if (portionPct !== null && portionPct < PORTION_MIN_PCT) issues.add("PORTION_SMALL");
  return { issues: Array.from(issues), portionPct, note: noteOf(data) };
}

// Қайтарылған табақтар фотосы: ИИ табақтарда қалған тағамның үлесін бағалайды (жеу индексі = 100 − қалдық).
export const WASTE_ISSUES = ["NOT_TRAYS", "BLURRY", "SCREEN_OR_STOCK"] as const;
export type WasteIssue = (typeof WASTE_ISSUES)[number];
const WASTE_CODES = new Set<string>(WASTE_ISSUES);
export type WasteVerdict = { issues: WasteIssue[]; wastePct: number | null; note: string | null };

export function parseWasteVerdict(raw: string): WasteVerdict {
  const data = extractJson(raw);
  const issues = pickIssues<WasteIssue>(data, WASTE_CODES);
  if (data.is_returned_plates === false) issues.add("NOT_TRAYS");
  const wastePct = issues.has("NOT_TRAYS") ? null : pctOf(data.uneaten_pct);
  return { issues: Array.from(issues), wastePct, note: noteOf(data) };
}

// Смена алдындағы тексеру: бас киім/тор, қолғап, алжапқыш. Мас-еместігін фотодан бағалау сенімсіз, сондықтан жоқ.
export const UNIFORM_ISSUES = ["NO_PERSON", "HEAD_UNCOVERED", "NO_GLOVES", "NO_APRON", "DIRTY_UNIFORM", "BLURRY", "SCREEN_OR_STOCK"] as const;
export type UniformIssue = (typeof UNIFORM_ISSUES)[number];
const UNIFORM_CODES = new Set<string>(UNIFORM_ISSUES);
export type UniformVerdict = { issues: UniformIssue[]; note: string | null };

export function parseUniformVerdict(raw: string): UniformVerdict {
  const data = extractJson(raw);
  const issues = pickIssues<UniformIssue>(data, UNIFORM_CODES);
  if (data.person_visible === false) issues.add("NO_PERSON");
  if (data.head_covered === false) issues.add("HEAD_UNCOVERED");
  if (data.gloves === false) issues.add("NO_GLOVES");
  if (data.apron === false) issues.add("NO_APRON");
  return { issues: Array.from(issues), note: noteOf(data) };
}

/** Себеп кодтарын таңдалған тілдің атауларымен (t.photoIssues) ауыстырады. */
export function issueLabels(issues: string[], labels: Record<string, string>) {
  return issues.map((i) => labels[i] ?? i);
}
