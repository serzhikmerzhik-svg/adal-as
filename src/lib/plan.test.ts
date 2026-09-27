import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPlan, ingredientMatches, planDay, PLAN_DAYS } from "./plan";

test("planDay: 14 күндік цикл, 1-күн — дүйсенбі 5.01.2026", () => {
  assert.equal(planDay(new Date(2026, 0, 5)), 1);
  assert.equal(planDay(new Date(2026, 0, 18)), 14);
  assert.equal(planDay(new Date(2026, 0, 19)), 1);
  assert.equal(planDay(new Date(2026, 0, 4)), PLAN_DAYS); // циклдан бұрынғы күн де 1–14 аралығында
  for (let i = 0; i < 40; i++) {
    const day = planDay(new Date(2026, 8, 1 + i));
    assert.ok(day >= 1 && day <= PLAN_DAYS);
  }
});

test("ingredientMatches: партия техкартаға сай ма", () => {
  assert.equal(ingredientMatches("Сиыр еті", "Сиыр еті"), true);
  assert.equal(ingredientMatches("Сиыр еті", "сиыр еті (жауырын)"), true);
  assert.equal(ingredientMatches("Сиыр еті", "Шұжық"), false);
  assert.equal(ingredientMatches("Тауық еті", "Сиыр еті"), false);
  assert.equal(ingredientMatches("", "Сүт"), false);
});

test("hasPlan: бекітілген мәзір тек мектеп пен балабақшаға", () => {
  assert.equal(hasPlan("SCHOOL"), true);
  assert.equal(hasPlan("KINDERGARTEN"), true);
  assert.equal(hasPlan("RESTAURANT"), false);
});
