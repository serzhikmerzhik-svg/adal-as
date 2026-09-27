import { test } from "node:test";
import assert from "node:assert/strict";
import { isTempViolation, serveNorm } from "./temperature";

test("isTempViolation: беру нормасы тағам санатына байланысты", () => {
  // Сорпа мен ыстық сусын ≥75 °C, екінші тағам ≥65 °C, суық тағам ≤14 °C.
  assert.equal(isTempViolation("HOT_TEMP", 71.4, "SOUP"), true);
  assert.equal(isTempViolation("HOT_TEMP", 77.5, "SOUP"), false);
  assert.equal(isTempViolation("HOT_TEMP", 70, "MAIN"), false);
  assert.equal(isTempViolation("HOT_TEMP", 60, "MAIN"), true);
  assert.equal(isTempViolation("HOT_TEMP", 74, "HOT_DRINK"), true);
  assert.equal(isTempViolation("HOT_TEMP", 12, "COLD"), false);
  assert.equal(isTempViolation("HOT_TEMP", 20, "COLD"), true);
});

test("isTempViolation: тоңазытқыш 2–6 °C", () => {
  assert.equal(isTempViolation("FRIDGE_TEMP", 4), false);
  assert.equal(isTempViolation("FRIDGE_TEMP", 7.4), true);
  assert.equal(isTempViolation("FRIDGE_TEMP", 1), true);
});

test("serveNorm: сорпада төменгі шек, суық тағамда жоғарғы шек", () => {
  assert.deepEqual(serveNorm("SOUP"), { min: 75 });
  assert.deepEqual(serveNorm("COLD"), { max: 14 });
});
