import { test } from "node:test";
import assert from "node:assert/strict";
import { microdistrict, placeLabel, shortName } from "./format";

test("shortName: нөмірлі мектеп, гимназия, лицей", () => {
  assert.equal(shortName("Общеобразовательная средняя школа №17", "SCHOOL"), "№17 мектеп");
  assert.equal(shortName("Гимназия №13", "SCHOOL"), "№13 гимназия");
  assert.equal(shortName("Лицей №11 им. Т. Ашимбаева", "SCHOOL"), "№11 лицей");
});

test("shortName: балабақша, асхана және нөмірсіз мектеп", () => {
  assert.equal(shortName("Айналайын, детский сад №54", "KINDERGARTEN"), "«Айналайын» №54");
  assert.equal(shortName("Зейін, частный детский сад", "KINDERGARTEN"), "«Зейін»");
  assert.equal(shortName("Асия, столовая", "CANTEEN"), "«Асия»");
  assert.equal(shortName("Білім Әлемі, школа-лицей", "SCHOOL"), "Білім Әлемі");
});

test("shortName: seed атаулары", () => {
  assert.equal(shortName("№52 жалпы білім беретін мектеп", "SCHOOL"), "№52 мектеп");
  assert.equal(shortName("№44 мектеп-гимназия", "SCHOOL"), "№44 гимназия");
  assert.equal(shortName("Ақ желкен, мейрамхана", "RESTAURANT"), "«Ақ желкен»");
  assert.equal(shortName("Тұмар, кафе", "CAFE"), "«Тұмар»");
  assert.equal(shortName("Шұғыла, балабақша", "KINDERGARTEN"), "«Шұғыла»");
});

test("microdistrict: 2GIS мекенжай пішімдері", () => {
  assert.equal(microdistrict("13-й микрорайон, 51"), "13-мкр");
  assert.equal(microdistrict("микрорайон 29А, 5/6"), "29А-мкр");
  assert.equal(microdistrict("микрорайон 18А, 9"), "18А-мкр");
  assert.equal(microdistrict("жилмассив Жалын, 374"), "Жалын");
  assert.equal(microdistrict("улица Уәлиханов, 8/8"), null);
});

test("placeLabel: аудан + шағын аудан", () => {
  assert.equal(placeLabel("Ақтау қ.", "13-й микрорайон, 51"), "Ақтау, 13-мкр");
  assert.equal(placeLabel("Жаңаөзен қ.", "улица Абая, 2"), "Жаңаөзен");
});
