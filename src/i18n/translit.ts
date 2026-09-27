// Ағылшынша интерфейсте қазақша атауларды латын әрпімен көрсету («Мерей» → “Merei”).
// Қазақ латын әліпбиіне жақын, бірақ ағылшын оқырманға таныс әріптермен (і → i, ы → y).
const MAP: Record<string, string> = {
  а: "a", ә: "ä", б: "b", в: "v", г: "g", ғ: "ğ", д: "d", е: "e", ё: "io", ж: "j", з: "z",
  и: "i", й: "i", к: "k", қ: "q", л: "l", м: "m", н: "n", ң: "ñ", о: "o", ө: "ö", п: "p",
  р: "r", с: "s", т: "t", у: "u", ұ: "ū", ү: "ü", ф: "f", х: "h", һ: "h", ц: "ts", ч: "ch",
  ш: "ş", щ: "şş", ъ: "", ы: "y", і: "i", ь: "", э: "e", ю: "iu", я: "ia",
};

export function latin(text: string): string {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const mapped = MAP[lower];
    if (mapped === undefined) {
      out += ch;
    } else if (ch !== lower && mapped) {
      out += mapped[0].toUpperCase() + mapped.slice(1);
    } else {
      out += mapped;
    }
  }
  return out;
}
