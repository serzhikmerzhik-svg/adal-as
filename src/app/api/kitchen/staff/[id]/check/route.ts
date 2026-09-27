import { NextResponse, after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { consumeCaptureToken, isOwnPhotoUrl } from "@/lib/capture";
import { checkStaffUniform } from "@/lib/photo/check";
import { getT } from "@/i18n/server";

export const maxDuration = 60;

const bodySchema = z.object({ photo: z.string().min(1), captureToken: z.string().min(1) });

/**
 * Смена алдындағы форма тексеруі: фото тек камера экранынан (бір реттік токен), ИИ бас киім, қолғап
 * мен алжапқышты тексереді. Фото ДБ-ға да, файл қоймасына да жазылмайды — тек нәтиже.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const { id } = await params;
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: t.api.forbidden }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.photo.startsWith("data:") || !isOwnPhotoUrl(parsed.data.photo)) {
    return NextResponse.json({ error: t.api.invalid }, { status: 400 });
  }
  const staff = await prisma.staff.findFirst({ where: { id, schoolId: session.schoolId, active: true }, select: { id: true } });
  if (!staff) return NextResponse.json({ error: t.api.notFound }, { status: 404 });

  const valid = await consumeCaptureToken({ token: parsed.data.captureToken, schoolId: session.schoolId, purpose: "STAFF", targetId: staff.id });
  if (!valid) return NextResponse.json({ error: t.capture.tokenInvalid }, { status: 403 });

  const check = await prisma.staffCheck.create({ data: { staffId: staff.id, schoolId: session.schoolId } });
  const photo = parsed.data.photo;
  after(() => checkStaffUniform(check.id, photo));
  return NextResponse.json({ check: { id: check.id, aiStatus: check.aiStatus } });
}
