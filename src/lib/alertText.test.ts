import { test } from "node:test";
import assert from "node:assert/strict";
import { alertText } from "./alertText";
import { riskReasons } from "./risk/reasons";
import { getDict } from "@/i18n/dict";

const kk = getDict("kk");
const ru = getDict("ru");

test("alertText: ереже алерттері details бойынша таңдалған тілде", () => {
  const fridge = { reason: "…", rule: "FRIDGE", details: { key: "d1", label: "Ет тоңазытқышы", peakC: 11.3 } };
  assert.equal(alertText(fridge, ru, "ru"), "Холодильник «Ет тоңазытқышы»: 11.3 °C (норма 2–6 °C), датчик фиксирует подряд");
  const ingredient = { reason: "…", rule: "INGREDIENT", details: { key: "m1", dish: "Палау", expected: "Сиыр еті", actual: "Шұжық", batchCode: "К-2442" } };
  assert.equal(alertText(ingredient, kk, "kk"), "«Палау»: техкартада «Сиыр еті», партияда «Шұжық» (К-2442)");
});

test("alertText: қазақша кластер алерті сақталған мәтінмен, орысша — аудармасы", () => {
  const cluster = { reason: "4 оқушыда 120 минут ішінде ішек-қарын белгілері тіркелді", rule: null, details: { reportIds: ["a", "b", "c", "d"] } };
  assert.equal(alertText(cluster, kk, "kk"), cluster.reason);
  assert.match(alertText(cluster, ru, "ru"), /4 учеников за 120 минут/);
});

test("riskReasons: тоңазытқыш ақауы бірінші, содан кейін тәуекел құрамы", () => {
  const reasons = riskReasons({ tempViolations: 10, missingPhotos: 0 }, [{ level: "RED", batchCode: null, rule: "FRIDGE" }], kk);
  assert.equal(reasons[0], kk.rules.names.FRIDGE);
  assert.equal(reasons[1], kk.reasons.temp("2"));
});
