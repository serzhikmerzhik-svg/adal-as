import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceM, isOwnPhotoUrl, MAX_PHOTO_CHARS, qrPayload, qrRequired } from "./capture";

test("distanceM: бір нүкте — 0 м, ендік бойынша 0,001° ≈ 111 м", () => {
  const a = { lat: 43.65, lng: 51.16 };
  assert.equal(distanceM(a, a), 0);
  assert.equal(distanceM(a, { lat: 43.651, lng: 51.16 }), 111);
});

test("isOwnPhotoUrl: тек сығылған сурет не Vercel Blob", () => {
  assert.equal(isOwnPhotoUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg=="), true);
  assert.equal(isOwnPhotoUrl("https://abc123.public.blob.vercel-storage.com/kitchen/1-portion.jpg"), true);
  // Бөгде адрес, ішкі желі, басқа тип немесе тым үлкен файл қабылданбайды.
  assert.equal(isOwnPhotoUrl("http://169.254.169.254/latest/meta-data"), false);
  assert.equal(isOwnPhotoUrl("https://example.com/plate.jpg"), false);
  assert.equal(isOwnPhotoUrl("http://abc123.public.blob.vercel-storage.com/x.jpg"), false);
  assert.equal(isOwnPhotoUrl("data:text/html;base64,PGgxPg=="), false);
  assert.equal(isOwnPhotoUrl(`data:image/jpeg;base64,${"A".repeat(MAX_PHOTO_CHARS)}`), false);
});

test("QR-тұғыр: мазмұны нысан коды, тек порция фотосында міндетті", () => {
  assert.equal(qrPayload("А-12"), "ADALAS:А-12");
  assert.equal(qrRequired("PORTION"), true);
  assert.equal(qrRequired("PROOF"), false);
});
