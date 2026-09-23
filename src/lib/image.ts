/** Суретті клиентте максимум ~200 KB болатындай сығып, data URL қайтарады. */
export async function compressImageToDataUrl(file: File, maxSizeKB = 200): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 1280;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas контекст жоқ");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let quality = 0.8;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length / 1024 > maxSizeKB && quality > 0.2) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  return dataUrl;
}
