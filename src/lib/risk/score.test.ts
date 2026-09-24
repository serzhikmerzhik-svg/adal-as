import { test } from "node:test";
import assert from "node:assert/strict";
import { totalScore, levelForScore, type RiskComponents } from "./score";

function components(partial: Partial<RiskComponents> = {}): RiskComponents {
  return {
    tempViolations: 0,
    missingPhotos: 0,
    parentRating: 0,
    complaintSpike: 0,
    supplierRisk: 0,
    inspectionAge: 0,
    overduePrescriptions: 0,
    ...partial,
  };
}

test("totalScore барлық құрамдас бөліктерді қосады", () => {
  const score = totalScore(components({ tempViolations: 10, missingPhotos: 5, parentRating: 8 }));
  assert.equal(score, 23);
});

test("totalScore 100-ден аспайды", () => {
  const score = totalScore(
    components({ tempViolations: 25, missingPhotos: 15, parentRating: 15, complaintSpike: 10, supplierRisk: 15, inspectionAge: 10, overduePrescriptions: 10 }),
  );
  assert.equal(score, 100);
});

test("levelForScore: 40-ден төмен GREEN", () => {
  assert.equal(levelForScore(39, false), "GREEN");
});

test("levelForScore: 40-69 аралығы YELLOW", () => {
  assert.equal(levelForScore(40, false), "YELLOW");
  assert.equal(levelForScore(69, false), "YELLOW");
});

test("levelForScore: 70+ RED", () => {
  assert.equal(levelForScore(70, false), "RED");
});

test("levelForScore: ашық қызыл алерт болса, балл төмен болса да RED", () => {
  assert.equal(levelForScore(10, true), "RED");
});

test("levelForScore: партияны қадағалау алерті бар мектеп кемінде YELLOW", () => {
  assert.equal(levelForScore(0, false, true), "YELLOW");
  assert.equal(levelForScore(75, false, true), "RED");
});
