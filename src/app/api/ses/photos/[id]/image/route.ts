import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// Порция фотосын береді: Vercel Blob URL болса соған бағыттайды, data URL болса байттарын қайтарады.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const log = await prisma.kitchenLog.findUnique({ where: { id }, select: { photoUrl: true } });
  if (!log?.photoUrl) return NextResponse.json({ error: "Фото табылмады" }, { status: 404 });

  if (!log.photoUrl.startsWith("data:")) return NextResponse.redirect(log.photoUrl);
  const match = log.photoUrl.match(/^data:([^;,]+)?;base64,([\s\S]*)$/);
  if (!match) return NextResponse.json({ error: "Фото пішімі дұрыс емес" }, { status: 415 });
  return new Response(Buffer.from(match[2], "base64"), {
    headers: { "Content-Type": match[1] || "image/jpeg", "Cache-Control": "private, max-age=86400, immutable" },
  });
}
