import { NextResponse, after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { TEMP } from "@/lib/risk/config";
import { recomputeSchoolRisk } from "@/lib/risk/score";
import { checkPhotoLog } from "@/lib/photo/check";
import { consumeCaptureToken, isOwnPhotoUrl, qrPayload } from "@/lib/capture";
import { getT } from "@/i18n/server";

// Тәуекел мен фото тексеруі жауаптан кейін (after) жүреді, асхана күтіп тұрмайды.
export const maxDuration = 60;

const bodySchema = z.object({
  menuItemId: z.string().optional(),
  type: z.enum(["PHOTO", "FRIDGE_TEMP", "HOT_TEMP"]),
  valueC: z.number().optional(),
  photoUrl: z.string().optional(),
  // Тек PHOTO үшін: камера экранында алынған бір реттік токен және кадрда танылған QR-тұғыр.
  captureToken: z.string().optional(),
  qrCode: z.string().optional(),
});

function isViolation(type: "FRIDGE_TEMP" | "HOT_TEMP", valueC: number) {
  if (type === "FRIDGE_TEMP") return valueC < TEMP.FRIDGE_MIN || valueC > TEMP.FRIDGE_MAX;
  return valueC < TEMP.HOT_MIN;
}

export async function POST(request: Request) {
  const t = await getT();
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: t.api.forbidden }, { status: 400 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: t.api.invalid }, { status: 400 });
  const { menuItemId, type, valueC, photoUrl, captureToken, qrCode } = parsed.data;

  if (type !== "PHOTO" && valueC === undefined) return NextResponse.json({ error: t.api.invalid }, { status: 400 });

  if (type === "PHOTO") {
    if (!photoUrl || !menuItemId || !isOwnPhotoUrl(photoUrl)) return NextResponse.json({ error: t.api.invalid }, { status: 400 });
    // Фото тек камера экранынан: кадрда QR-тұғыр және бір реттік токен (мерзімі өтпеген, қолданылмаған) болуы керек.
    const school = await prisma.school.findUniqueOrThrow({ where: { id: session.schoolId }, select: { code: true, name: true } });
    if (qrCode !== qrPayload(school.code ?? school.name)) {
      return NextResponse.json({ error: t.capture.qrMissing }, { status: 403 });
    }
    const valid =
      !!captureToken &&
      (await consumeCaptureToken({ token: captureToken, schoolId: session.schoolId, purpose: "PORTION", targetId: menuItemId }));
    if (!valid) return NextResponse.json({ error: t.capture.tokenInvalid }, { status: 403 });
  }

  const log = await prisma.kitchenLog.create({
    data: {
      schoolId: session.schoolId,
      menuItemId,
      type,
      valueC: type === "PHOTO" ? null : valueC,
      photoUrl: type === "PHOTO" ? photoUrl : null,
      isViolation: type !== "PHOTO" && valueC !== undefined ? isViolation(type, valueC) : false,
      createdById: session.userId,
      aiStatus: type === "PHOTO" ? "PENDING" : null,
    },
  });
  // Тәуекелді қайта есептеу мен фото тексеруі жауаптан кейін жүреді: асхана қызметкері бірден жалғастырады,
  // ал СЭС беті өзгерісті 5 секунд ішінде алады.
  const schoolId = session.schoolId;
  after(() => Promise.all([recomputeSchoolRisk(schoolId), type === "PHOTO" ? checkPhotoLog(log.id) : null]));

  return NextResponse.json({ log: { ...log, photoUrl: undefined } });
}
