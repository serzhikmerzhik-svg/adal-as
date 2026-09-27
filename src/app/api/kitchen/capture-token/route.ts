import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { getT } from "@/i18n/server";
import { distanceM, geofenceRadiusM, issueCaptureToken, qrPayload, qrRequired, trainingBypassEnabled, type CapturePurpose } from "@/lib/capture";

const bodySchema = z.object({
  purpose: z.enum(["PORTION", "PROOF", "STAFF", "WASTE"]),
  targetId: z.string().min(1),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

/** Түсірілетін нысана осы асханаға тиесілі ме: тағам, нұсқама не қызметкер. */
async function targetSchoolId(purpose: CapturePurpose, targetId: string) {
  if (purpose === "PORTION" || purpose === "WASTE") {
    return (await prisma.menuItem.findUnique({ where: { id: targetId }, select: { schoolId: true } }))?.schoolId;
  }
  if (purpose === "PROOF") return (await prisma.prescription.findUnique({ where: { id: targetId }, select: { schoolId: true } }))?.schoolId;
  return (await prisma.staff.findUnique({ where: { id: targetId }, select: { schoolId: true } }))?.schoolId;
}

// Камерадан түсіру алдында: нысан аумағында екенін тексеріп, 2 минуттық бір реттік токен береді.
export async function POST(request: Request) {
  const t = await getT();
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: t.api.forbidden }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: t.api.invalid }, { status: 400 });
  const { purpose, targetId, lat, lng } = parsed.data;

  if ((await targetSchoolId(purpose, targetId)) !== session.schoolId) return NextResponse.json({ error: t.api.notFound }, { status: 404 });

  const school = await prisma.school.findUniqueOrThrow({
    where: { id: session.schoolId },
    select: { code: true, name: true, lat: true, lng: true, isTraining: true },
  });
  const bypass = school.isTraining && trainingBypassEnabled();
  const radius = geofenceRadiusM();
  const distance = lat !== undefined && lng !== undefined ? distanceM({ lat, lng }, school) : null;

  if (!bypass) {
    if (distance === null) return NextResponse.json({ error: t.capture.noLocation, reason: "NO_LOCATION" }, { status: 403 });
    if (distance > radius) {
      return NextResponse.json({ error: t.capture.outside(distance, radius), reason: "OUTSIDE", distanceM: distance }, { status: 403 });
    }
  }

  const token = await issueCaptureToken({ schoolId: session.schoolId, purpose, targetId, distanceM: distance });
  const code = school.code ?? school.name;
  return NextResponse.json({
    token: token.id,
    expiresAt: token.expiresAt.toISOString(),
    serverTime: new Date().toISOString(),
    code,
    qrPayload: qrPayload(code),
    qrRequired: qrRequired(purpose),
    geofence: { distanceM: distance, radiusM: radius, bypass },
  });
}
