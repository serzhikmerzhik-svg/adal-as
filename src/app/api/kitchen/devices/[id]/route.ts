import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { getT } from "@/i18n/server";

/** Құрылғыны өшіру: кілті бұдан былай қабылданбайды, өлшемдер тарихы сақталады. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const { id } = await params;
  const session = await getSession();
  if (!session?.schoolId) return NextResponse.json({ error: t.api.forbidden }, { status: 403 });
  const result = await prisma.device.updateMany({
    where: { id, schoolId: session.schoolId, revokedAt: null },
    data: { revokedAt: new Date(), armedTarget: null, armedAt: null },
  });
  if (result.count === 0) return NextResponse.json({ error: t.api.notFound }, { status: 404 });
  return NextResponse.json({ ok: true });
}
