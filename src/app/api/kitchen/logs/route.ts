import { NextResponse, after } from "next/server";
import { z } from "zod";
import type { DishCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { recomputeSchoolRisk } from "@/lib/risk/score";
import { checkPhotoLog, checkWasteLog } from "@/lib/photo/check";
import { consumeCaptureToken, isOwnPhotoUrl, qrPayload } from "@/lib/capture";
import { isTempViolation } from "@/lib/temperature";
import { getT } from "@/i18n/server";

// Тәуекел мен фото тексеруі жауаптан кейін (after) жүреді, асхана күтіп тұрмайды.
export const maxDuration = 60;

const bodySchema = z.object({
  menuItemId: z.string().optional(),
  type: z.enum(["PHOTO", "FRIDGE_TEMP", "HOT_TEMP", "WASTE"]),
  valueC: z.number().optional(),
  photoUrl: z.string().optional(),
  // Тек фото үшін: камера экранында алынған бір реттік токен; порцияда кадрда танылған QR-тұғыр да.
  captureToken: z.string().optional(),
  qrCode: z.string().optional(),
});

export async function POST(request: Request) {
  const t = await getT();
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: t.api.forbidden }, { status: 400 });
  const schoolId = session.schoolId;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: t.api.invalid }, { status: 400 });
  const { menuItemId, type, valueC, photoUrl, captureToken, qrCode } = parsed.data;
  const isPhoto = type === "PHOTO" || type === "WASTE";

  if (!isPhoto && valueC === undefined) return NextResponse.json({ error: t.api.invalid }, { status: 400 });

  // Беру температурасының нормасы тағам санатына байланысты (сорпа ≥75 °C, екінші тағам ≥65 °C).
  let category: DishCategory = "MAIN";
  if (menuItemId) {
    const item = await prisma.menuItem.findFirst({ where: { id: menuItemId, schoolId }, select: { category: true } });
    if (!item) return NextResponse.json({ error: t.api.notFound }, { status: 404 });
    category = item.category;
  }

  if (isPhoto) {
    if (!photoUrl || !menuItemId || !isOwnPhotoUrl(photoUrl)) return NextResponse.json({ error: t.api.invalid }, { status: 400 });
    // Порция фотосы: кадрда QR-тұғыр болуы керек. Екі жағдайда да бір реттік токен (мерзімі өтпеген, қолданылмаған).
    if (type === "PHOTO") {
      const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { code: true, name: true } });
      if (qrCode !== qrPayload(school.code ?? school.name)) {
        return NextResponse.json({ error: t.capture.qrMissing }, { status: 403 });
      }
    }
    const valid =
      !!captureToken &&
      (await consumeCaptureToken({ token: captureToken, schoolId, purpose: type === "PHOTO" ? "PORTION" : "WASTE", targetId: menuItemId }));
    if (!valid) return NextResponse.json({ error: t.capture.tokenInvalid }, { status: 403 });
  }

  const log = await prisma.kitchenLog.create({
    data: {
      schoolId,
      menuItemId,
      type,
      valueC: isPhoto ? null : valueC,
      photoUrl: isPhoto ? photoUrl : null,
      isViolation: !isPhoto && valueC !== undefined ? isTempViolation(type, valueC, category) : false,
      createdById: session.userId,
      aiStatus: isPhoto ? "PENDING" : null,
    },
  });
  // Тәуекелді қайта есептеу мен фото тексеруі жауаптан кейін жүреді: асхана қызметкері бірден жалғастырады,
  // ал СЭС беті өзгерісті 5 секунд ішінде алады.
  after(() =>
    Promise.all([
      recomputeSchoolRisk(schoolId),
      type === "PHOTO" ? checkPhotoLog(log.id) : type === "WASTE" ? checkWasteLog(log.id) : null,
    ]),
  );

  return NextResponse.json({ log: { ...log, photoUrl: undefined } });
}
