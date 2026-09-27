import { test } from "node:test";
import assert from "node:assert/strict";
import { parseModelVerdict, parseUniformVerdict, parseWasteVerdict } from "./verdict";

test("parseModelVerdict: таза JSON, қалыпты порция", () => {
  const v = parseModelVerdict('{"is_food": true, "dish_matches": true, "portion_pct": 100, "issues": [], "note": "Порция нормаға сай."}');
  assert.deepEqual(v.issues, []);
  assert.equal(v.portionPct, 100);
  assert.equal(v.note, "Порция нормаға сай.");
});

test("parseModelVerdict: ```json блогы, аз порция мен сәйкес емес тағам", () => {
  const raw = 'Міне жауап:\n```json\n{"is_food": true, "dish_matches": false, "portion_pct": 55.4, "issues": ["blurry", "UNKNOWN"]}\n```';
  const v = parseModelVerdict(raw);
  assert.deepEqual(v.issues.sort(), ["BLURRY", "DISH_MISMATCH", "PORTION_SMALL"]);
  assert.equal(v.portionPct, 55);
  assert.equal(v.note, null);
});

test("parseModelVerdict: тағам емес сурет", () => {
  const v = parseModelVerdict('{"is_food": false, "portion_pct": null, "issues": ["SCREEN_OR_STOCK"], "note": "Экраннан түсірілген."}');
  assert.deepEqual(v.issues.sort(), ["NOT_FOOD", "SCREEN_OR_STOCK"]);
  assert.equal(v.portionPct, null);
});

test("parseModelVerdict: JSON жоқ болса қате", () => {
  assert.throws(() => parseModelVerdict("Кешіріңіз, сурет көрінбейді."));
});

test("parseWasteVerdict: қалған үлес, табақ емес сурет", () => {
  const v = parseWasteVerdict('{"is_returned_plates": true, "uneaten_pct": 68.4, "issues": [], "note": "Көбі қалған."}');
  assert.equal(v.wastePct, 68);
  assert.deepEqual(v.issues, []);
  const notTrays = parseWasteVerdict('{"is_returned_plates": false, "uneaten_pct": 10, "issues": []}');
  assert.deepEqual(notTrays.issues, ["NOT_TRAYS"]);
  assert.equal(notTrays.wastePct, null);
});

test("parseUniformVerdict: бас киім мен қолғап жоқ", () => {
  const v = parseUniformVerdict('{"person_visible": true, "head_covered": false, "gloves": false, "apron": true, "issues": [], "note": "Шаш ашық."}');
  assert.deepEqual(v.issues.sort(), ["HEAD_UNCOVERED", "NO_GLOVES"]);
  const ok = parseUniformVerdict('{"person_visible": true, "head_covered": true, "gloves": true, "apron": true, "issues": []}');
  assert.deepEqual(ok.issues, []);
});
