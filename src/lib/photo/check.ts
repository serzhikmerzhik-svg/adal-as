import { createHash } from "node:crypto";
import type { PhotoCheck } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { FACILITY_KIND_LABEL } from "@/lib/risk/labels";
import { parseModelVerdict, type ModelVerdict, type PhotoIssue } from "./verdict";

// ИИ OpenAI-үйлесімді кез келген шлюз арқылы шақырылады. Әдепкі жоспар — OmniRoute
// (AI_BASE_URL=http://localhost:20128/v1, AI_MODEL — суретті түсінетін модель). AI_BASE_URL
// берілмесе, ИИ өшірулі: тек қайталанған фото тексеріледі, нәтиже «ИИ қосылмаған» болады.
const AI_TIMEOUT_MS = 45_000;

const SYSTEM_PROMPT = `You review photos of served food portions for the sanitary-epidemiological service (SES) in Aktau, Kazakhstan.
Canteen staff photograph each served dish to prove it matches the menu and the standard portion. Inspectors cannot look at every photo, so you decide which ones need a human.
Answer ONLY with one JSON object, no other text:
{"is_food": boolean, "dish_matches": boolean | null, "portion_pct": number | null, "issues": string[], "note": string}
- portion_pct: served amount as a percentage of the standard portion (100 = matches). null if the standard is unknown or you cannot judge.
- issues: zero or more of NOT_FOOD, NO_PORTION, PORTION_SMALL, DISH_MISMATCH, BLURRY, SCREEN_OR_STOCK, HYGIENE, SPOILED.
  PORTION_SMALL when portion_pct < 80. SCREEN_OR_STOCK when it looks like a photo of a screen, an advertising/stock image or a drawing instead of a real plate. HYGIENE only for visible problems (dirt, hair, insects, dirty dishes).
- note: one short sentence in Kazakh explaining the decision.
Be strict but fair: ordinary lighting, angle or plating differences are not issues.`;

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
  if (!baseUrl) return null;
  return { baseUrl, model: process.env.AI_MODEL || "auto", apiKey: process.env.AI_API_KEY };
}

/** Chat Completions жауабындағы мәтін: кейбір провайдерлер content-ті бөліктер массиві ретінде қайтарады. */
function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "object" && part && "text" in part ? String(part.text) : "")).join("");
  }
  return "";
}

async function askVisionModel(
  config: NonNullable<ReturnType<typeof aiConfig>>,
  image: LoadedImage,
  context: string,
): Promise<ModelVerdict & { model: string }> {
  const body = {
    model: config.model,
    temperature: 0,
    max_tokens: 400,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: context },
          { type: "image_url", image_url: { url: image.dataUrl } },
        ],
      },
    ],
  };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  // Алдымен JSON режимімен сұраймыз; оны қолдамайтын провайдер 400 қайтарса, режимсіз қайталаймыз.
  let res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, response_format: { type: "json_object" } }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (res.status === 400) {
    res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
  }
  if (!res.ok) throw new Error(`ИИ шлюзі ${res.status} қайтарды: ${(await res.text()).slice(0, 160)}`);

  const json = (await res.json()) as { model?: string; choices?: { message?: { content?: unknown } }[] };
  const text = messageText(json.choices?.[0]?.message?.content);
  return { ...parseModelVerdict(text), model: json.model ?? config.model };
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
        verdict = await askVisionModel(config, image, context);
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
