import { createHash } from "node:crypto";
import type { PhotoCheck } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { FACILITY_KIND_LABEL } from "@/lib/risk/labels";
import { checkEatability } from "@/lib/rules";
import { parseModelVerdict, parseUniformVerdict, parseWasteVerdict, type ModelVerdict, type PhotoIssue } from "./verdict";

// ИИ OpenAI-үйлесімді кез келген API арқылы шақырылады: Google Gemini
// (AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai) немесе жергілікті шлюз.
// Мекенжай не кілт берілмесе, ИИ өшірулі: тек қайталанған фото тексеріледі, нәтиже «ИИ қосылмаған».
const AI_TIMEOUT_MS = 45_000;

const SYSTEM_PROMPT = `You review photos of served food portions for the sanitary-epidemiological service (SES) in Aktau, Kazakhstan.
Canteen staff photograph each served dish to prove it matches the menu and the standard portion. Inspectors cannot look at every photo, so you decide which ones need a human.
Answer ONLY with one JSON object, no other text:
{"is_food": boolean, "dish_matches": boolean | null, "portion_pct": number | null, "issues": string[], "note": string}
- portion_pct: served amount as a percentage of the standard portion (100 = matches). null if the standard is unknown or you cannot judge.
- issues: zero or more of NOT_FOOD, NO_PORTION, PORTION_SMALL, DISH_MISMATCH, BLURRY, SCREEN_OR_STOCK, HYGIENE, SPOILED.
  PORTION_SMALL when portion_pct < 80. SCREEN_OR_STOCK when it looks like a photo of a screen, an advertising/stock image or a drawing instead of a real plate. HYGIENE only for visible problems (dirt, hair, insects, dirty dishes).
- note: one short sentence in Kazakh explaining the decision.
Be strict but fair: ordinary lighting, angle or plating differences are not issues.
The app itself adds a dark band at the bottom ("Adal As · <facility code> · <date time>" and a token id), and a printed QR stand is placed next to the plate on purpose. Both are expected: never treat them as a screen, stock image or any other issue.`;

// Қайтарылған табақтар: жеу индексі (ИИ табақтарда қалған тағамның үлесін бағалайды).
const WASTE_PROMPT = `You review photos of returned plates and trays after a school or kindergarten meal in Aktau, Kazakhstan.
If children leave most of a dish uneaten, the sanitary service (SES) treats it as a sign that the cooking technology was broken (raw, oversalted, spoiled or cold food) and plans a quality check.
Answer ONLY with one JSON object, no other text:
{"is_returned_plates": boolean, "uneaten_pct": number | null, "issues": string[], "note": string}
- uneaten_pct: share of the served food still left on the plates/trays, 0–100 (0 = everything eaten). null if you cannot judge.
- issues: zero or more of NOT_TRAYS (not a photo of returned plates or a waste bin), BLURRY, SCREEN_OR_STOCK.
- note: one short sentence in Kazakh.
The app adds a dark band at the bottom ("Adal As · <code> · <date time>"); it is expected, never an issue.`;

// Смена алдындағы тексеру: тек форма. Адамды танымайды, бет-әлпетін сипаттамайды, мас-еместігін бағаламайды.
const UNIFORM_PROMPT = `You check the uniform of a canteen cook before the shift for the sanitary service (SES) in Aktau, Kazakhstan.
Look only at the uniform. Do not identify the person, do not describe the face, do not guess health, age, emotions or sobriety.
Answer ONLY with one JSON object, no other text:
{"person_visible": boolean, "head_covered": boolean | null, "gloves": boolean | null, "apron": boolean | null, "issues": string[], "note": string}
- head_covered: hair is fully under a cap, hat or hairnet. gloves: disposable gloves are on both visible hands. apron: a clean apron or white coat is worn.
- The cook is asked to face the camera from head to waist with both hands raised in front of the chest. If the head is cut off, head_covered = false; if the hands are not visible, gloves = false.
- issues: zero or more of NO_PERSON, HEAD_UNCOVERED, NO_GLOVES, NO_APRON, DIRTY_UNIFORM, BLURRY, SCREEN_OR_STOCK.
- note: one short sentence in Kazakh.
The app adds a dark band at the bottom ("Adal As · <code> · <date time>"); it is expected, never an issue.`;

type LoadedImage = { bytes: Buffer; mediaType: string; dataUrl: string };

async function loadImage(photoUrl: string): Promise<LoadedImage> {
  if (photoUrl.startsWith("data:")) {
    const match = photoUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
    if (!match) throw new Error("Фото data URL пішімі дұрыс емес");
    const mediaType = match[1] || "image/jpeg";
    const bytes = match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]));
    return { bytes, mediaType, dataUrl: photoUrl };
  }
  const res = await fetch(photoUrl, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Фотоны жүктеу мүмкін болмады: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const mediaType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  return { bytes, mediaType, dataUrl: `data:${mediaType};base64,${bytes.toString("base64")}` };
}

function aiConfig() {
  const baseUrl = process.env.AI_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.AI_API_KEY || undefined;
  // Қашықтағы API кілтсіз жауап бермейді: кілт қойылғанша ИИ өшірулі деп саналады (қате емес).
  if (!baseUrl || (!apiKey && !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(`${baseUrl}/`))) return null;
  // AI_MODEL — үтірмен бөлінген тізім: бірінші модель бос болмаса (503/429), келесісі сұралады.
  const models = (process.env.AI_MODEL || "gemini-flash-latest,gemini-3.8-flash")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return { baseUrl, models, apiKey };
}

// Модель уақытша бос емес, лимит біткен немесе жаңа пайдаланушыларға жабық — келесі модельге көшеміз.
const TRY_NEXT_MODEL = new Set([404, 429, 500, 502, 503, 504]);

/** Chat Completions жауабындағы мәтін: кейбір провайдерлер content-ті бөліктер массиві ретінде қайтарады. */
function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "object" && part && "text" in part ? String(part.text) : "")).join("");
  }
  return "";
}

/** Суретті модельге жібереді және жауап мәтінін қайтарады; модель бос болмаса (503/429), тізімдегі келесісі сұралады. */
async function askVision(
  config: NonNullable<ReturnType<typeof aiConfig>>,
  system: string,
  image: LoadedImage,
  context: string,
): Promise<{ text: string; model: string }> {
  const messages = [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        { type: "text", text: context },
        { type: "image_url", image_url: { url: image.dataUrl } },
      ],
    },
  ];
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const call = (body: object) =>
    fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

  let lastError = "ИИ модельдері көрсетілмеген";
  for (const model of config.models) {
    const body = { model, temperature: 0, max_tokens: 400, messages };
    // Алдымен JSON режимімен сұраймыз; оны қолдамайтын провайдер 400 қайтарса, режимсіз қайталаймыз.
    let res = await call({ ...body, response_format: { type: "json_object" } });
    if (res.status === 400) res = await call(body);
    if (res.ok) {
      const json = (await res.json()) as { model?: string; choices?: { message?: { content?: unknown } }[] };
      return { text: messageText(json.choices?.[0]?.message?.content), model: json.model ?? model };
    }
    lastError = `ИИ (${model}) ${res.status} қайтарды: ${(await res.text()).slice(0, 160)}`;
    if (!TRY_NEXT_MODEL.has(res.status)) break;
  }
  throw new Error(lastError);
}

/**
 * Асхана жүктеген PHOTO жазбасын тексереді: sha256 бойынша қайталануды табады, ИИ-ден порция мен
 * тағамды бағалауды сұрайды және нәтижені KitchenLog-қа жазады. Жүктеуден кейін after() ішінде шақырылады.
 */
export async function checkPhotoLog(logId: string) {
  const log = await prisma.kitchenLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      photoUrl: true,
      menuItem: { select: { name: true, standardPortionG: true } },
      school: { select: { kind: true } },
    },
  });
  if (!log?.photoUrl) return;

  let photoHash: string | null = null;
  let duplicate = false;
  try {
    const image = await loadImage(log.photoUrl);
    photoHash = createHash("sha256").update(image.bytes).digest("hex");
    duplicate = !!(await prisma.kitchenLog.findFirst({
      where: { type: "PHOTO", photoHash, id: { not: log.id } },
      select: { id: true },
    }));

    const config = aiConfig();
    let verdict: (ModelVerdict & { model: string }) | null = null;
    let status: PhotoCheck = "DISABLED";
    let summary: string | null = config ? null : "ИИ қосылмаған: тек қайталанған фото тексерілді";
    if (config) {
      const context = [
        `Нысан: ${FACILITY_KIND_LABEL[log.school.kind] ?? log.school.kind}.`,
        `Мәзірдегі тағам: ${log.menuItem?.name ?? "белгісіз"}.`,
        `Стандарт порция: ${log.menuItem?.standardPortionG ? `${log.menuItem.standardPortionG} г` : "белгісіз"}.`,
      ].join(" ");
      try {
        const answer = await askVision(config, SYSTEM_PROMPT, image, context);
        verdict = { ...parseModelVerdict(answer.text), model: answer.model };
        summary = verdict.note;
      } catch (e) {
        status = "ERROR";
        summary = e instanceof Error ? e.message.slice(0, 200) : "ИИ жауап бермеді";
      }
    }

    const issues: PhotoIssue[] = [...(verdict?.issues ?? []), ...(duplicate ? (["DUPLICATE"] as const) : [])];
    if (issues.length > 0) status = "FLAGGED";
    else if (verdict) status = "OK";

    await prisma.kitchenLog.update({
      where: { id: log.id },
      data: {
        photoHash,
        aiStatus: status,
        aiIssues: issues,
        aiPortionPct: verdict?.portionPct ?? null,
        aiSummary: summary,
        aiModel: verdict?.model ?? null,
        aiCheckedAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.kitchenLog.update({
      where: { id: log.id },
      data: {
        photoHash,
        aiStatus: duplicate ? "FLAGGED" : "ERROR",
        aiIssues: duplicate ? ["DUPLICATE"] : [],
        aiSummary: e instanceof Error ? e.message.slice(0, 200) : "Фотоны тексеру мүмкін болмады",
        aiCheckedAt: new Date(),
      },
    });
  }
}

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/**
 * Қайтарылған табақтар фотосы (WASTE): ИИ табақта қалған тағамның үлесін бағалайды. Жеу индексі
 * EATABILITY.LOW_PCT-тен төмен болса, СЭС-ке сары алерт кетеді (сапаны тексеру ұсынылады).
 */
export async function checkWasteLog(logId: string) {
  const log = await prisma.kitchenLog.findUnique({ where: { id: logId }, select: { id: true, photoUrl: true, menuItem: { select: { name: true } } } });
  if (!log?.photoUrl) return;
  const config = aiConfig();
  try {
    const image = await loadImage(log.photoUrl);
    if (!config) {
      await prisma.kitchenLog.update({
        where: { id: log.id },
        data: { photoHash: sha256(image.bytes), aiStatus: "DISABLED", aiSummary: "ИИ қосылмаған", aiCheckedAt: new Date() },
      });
      return;
    }
    const answer = await askVision(config, WASTE_PROMPT, image, `Тағам: ${log.menuItem?.name ?? "белгісіз"}.`);
    const verdict = parseWasteVerdict(answer.text);
    await prisma.kitchenLog.update({
      where: { id: log.id },
      data: {
        photoHash: sha256(image.bytes),
        aiStatus: verdict.issues.length > 0 ? "FLAGGED" : "OK",
        aiIssues: verdict.issues,
        aiWastePct: verdict.wastePct,
        aiSummary: verdict.note,
        aiModel: answer.model,
        aiCheckedAt: new Date(),
      },
    });
    if (verdict.wastePct !== null) await checkEatability(log.id);
  } catch (e) {
    await prisma.kitchenLog.update({
      where: { id: log.id },
      data: { aiStatus: "ERROR", aiSummary: e instanceof Error ? e.message.slice(0, 200) : "ИИ жауап бермеді", aiCheckedAt: new Date() },
    });
  }
}

/**
 * Смена алдындағы форма тексеруі. Фото тек осы шақыруда жадта болады және ДБ-ға жазылмайды:
 * StaffCheck-те тек нәтиже мен хэш қалады.
 */
export async function checkStaffUniform(checkId: string, dataUrl: string) {
  const config = aiConfig();
  try {
    const image = await loadImage(dataUrl);
    const photoHash = sha256(image.bytes);
    const duplicate = !!(await prisma.staffCheck.findFirst({ where: { photoHash, id: { not: checkId } }, select: { id: true } }));
    if (!config) {
      await prisma.staffCheck.update({
        where: { id: checkId },
        data: { photoHash, aiStatus: duplicate ? "FLAGGED" : "DISABLED", aiIssues: duplicate ? ["DUPLICATE"] : [], aiSummary: "ИИ қосылмаған", aiCheckedAt: new Date() },
      });
      return;
    }
    const answer = await askVision(config, UNIFORM_PROMPT, image, "Асхана қызметкері смена алдында.");
    const verdict = parseUniformVerdict(answer.text);
    const issues = [...verdict.issues, ...(duplicate ? ["DUPLICATE"] : [])];
    await prisma.staffCheck.update({
      where: { id: checkId },
      data: {
        photoHash,
        aiStatus: issues.length > 0 ? "FLAGGED" : "OK",
        aiIssues: issues,
        aiSummary: verdict.note,
        aiModel: answer.model,
        aiCheckedAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.staffCheck.update({
      where: { id: checkId },
      data: { aiStatus: "ERROR", aiSummary: e instanceof Error ? e.message.slice(0, 200) : "ИИ жауап бермеді", aiCheckedAt: new Date() },
    });
  }
}
