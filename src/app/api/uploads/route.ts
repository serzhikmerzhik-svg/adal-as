import { NextResponse } from "next/server";
import { z } from "zod";
import { isOwnPhotoUrl } from "@/lib/capture";
import { getT } from "@/i18n/server";

const bodySchema = z.object({
  dataUrl: z.string().min(1),
  filename: z.string().default("photo.jpg"),
});

// BLOB_READ_WRITE_TOKEN бар болса, Vercel Blob-қа жүктейді. Болмаса, клиентте
// сығылған data URL-ды сол қалпында қайтарады (ол тікелей KitchenLog.photoUrl-ға жазылады).
export async function POST(request: Request) {
  const t = await getT();
  const parsed = bodySchema.safeParse(await request.json());
  // Тек камера экраны жасаған сығылған JPEG/PNG/WebP қабылданады.
  if (!parsed.success || !parsed.data.dataUrl.startsWith("data:") || !isOwnPhotoUrl(parsed.data.dataUrl)) {
    return NextResponse.json({ error: t.api.invalid }, { status: 400 });
  }
  const { dataUrl, filename } = parsed.data;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ url: dataUrl });
  }

  const { put } = await import("@vercel/blob");
  const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
  const blob = await put(`kitchen/${Date.now()}-${filename.replace(/[^\w.-]/g, "")}`, buffer, {
    access: "public",
    contentType: dataUrl.slice(5, dataUrl.indexOf(";")),
    addRandomSuffix: true,
  });

  return NextResponse.json({ url: blob.url });
}
