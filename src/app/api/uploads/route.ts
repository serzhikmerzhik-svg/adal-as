import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  dataUrl: z.string().min(1),
  filename: z.string().default("photo.jpg"),
});

// BLOB_READ_WRITE_TOKEN бар болса, Vercel Blob-қа жүктейді. Болмаса, клиентте
// сығылған data URL-ды сол қалпында қайтарады (ол тікелей KitchenLog.photoUrl-ға жазылады).
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Дұрыс емес деректер" }, { status: 400 });
  const { dataUrl, filename } = parsed.data;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ url: dataUrl });
  }

  const { put } = await import("@vercel/blob");
  const base64 = dataUrl.split(",")[1] ?? dataUrl;
  const buffer = Buffer.from(base64, "base64");
  const blob = await put(`kitchen/${Date.now()}-${filename}`, buffer, {
    access: "public",
    contentType: "image/jpeg",
  });

  return NextResponse.json({ url: blob.url });
}
