import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { hashDeviceKey, keyHint, newDeviceKey } from "@/lib/devices";
import { getT } from "@/i18n/server";

const bodySchema = z.object({
  kind: z.enum(["PROBE", "FRIDGE"]),
  label: z.string().trim().min(1).max(60),
});

/** Асхананың құрылғылары: соңғы өлшемі мен күйі. Кілттің өзі қайтарылмайды. */
export async function GET() {
  const t = await getT();
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: t.api.forbidden }, { status: 403 });
  const devices = await prisma.device.findMany({
    where: { schoolId: session.schoolId, revokedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, kind: true, label: true, keyHint: true, lastSeenAt: true, lastValue: true, armedTarget: true, armedAt: true },
  });
  return NextResponse.json({ devices });
}

/** Жаңа құрылғы: кілт осы жауапта бір рет көрсетіледі, ДБ-да тек хэші қалады. */
export async function POST(request: Request) {
  const t = await getT();
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: t.api.forbidden }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.invalid }, { status: 400 });

  const key = newDeviceKey();
  const device = await prisma.device.create({
    data: { schoolId: session.schoolId, kind: parsed.data.kind, label: parsed.data.label, keyHash: hashDeviceKey(key), keyHint: keyHint(key) },
    select: { id: true, kind: true, label: true, keyHint: true },
  });
  return NextResponse.json({ device, key });
}
