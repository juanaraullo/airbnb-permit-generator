// tests/filler.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as PDFLib from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fillGuestInfoSheet, fillGuestAuthorizationForm } from '../src/filler.js';
import { BUILDINGS } from '../src/config.js';

test('fillGuestInfoSheet places guest name, dates, unit, and companions at the calibrated positions', async () => {
  const templateBytes = readFileSync(new URL('../templates/uptown-guest-info.pdf', import.meta.url));
  const outBytes = await fillGuestInfoSheet(PDFLib, templateBytes, BUILDINGS.uptown.form, {
    registeredGuest: 'Juan Dela Cruz',
    stayFrom: 'Aug 20, 2026',
    stayTo: 'Aug 25, 2026',
    tower: 'Tower 2',
    unit: '24J',
    ownerName: 'Juan Araullo',
    dateSigned: 'Aug 20, 2026',
    companions: ['Maria Santos', 'Pedro Reyes'],
  });

  const doc = await pdfjsLib.getDocument({ data: outBytes }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const items = content.items.map((it) => ({ text: it.str, x: it.transform[4], y: it.transform[5] }));

  const guestItem = items.find((it) => it.text.includes('Juan Dela Cruz'));
  assert.ok(guestItem, 'registered guest name not found in filled PDF');
  assert.ok(Math.abs(guestItem.y - 855) < 2, `expected guest name near y=855, got y=${guestItem.y}`);

  assert.ok(items.some((it) => it.text.includes('Maria Santos')), 'companion 1 not found');
  assert.ok(items.some((it) => it.text.includes('Pedro Reyes')), 'companion 2 not found');
  assert.ok(items.some((it) => it.text.includes('24J')), 'unit not found');
  assert.ok(items.some((it) => it.text.includes('Aug 25, 2026')), 'stay-to date not found');
});

test('fillGuestInfoSheet embeds and centers a signature image without throwing', async () => {
  const templateBytes = readFileSync(new URL('../templates/uptown-guest-info.pdf', import.meta.url));
  const sampleData = {
    registeredGuest: 'Juan Dela Cruz',
    stayFrom: 'Aug 20, 2026',
    stayTo: 'Aug 25, 2026',
    tower: 'Tower 2',
    unit: '24J',
    ownerName: 'Juan Araullo',
    dateSigned: 'Aug 20, 2026',
    companions: ['Maria Santos', 'Pedro Reyes'],
  };

  const signaturePngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
    'base64'
  );

  const outBytesWithoutSignature = await fillGuestInfoSheet(PDFLib, templateBytes, BUILDINGS.uptown.form, sampleData);

  const outBytesWithSignature = await fillGuestInfoSheet(PDFLib, templateBytes, BUILDINGS.uptown.form, {
    ...sampleData,
    signaturePngBytes,
  });

  assert.ok(outBytesWithSignature.length > 0, 'fill with signature returned no bytes');
  assert.ok(
    outBytesWithSignature.length > outBytesWithoutSignature.length,
    `expected signature fill to produce more bytes than non-signature fill (with=${outBytesWithSignature.length}, without=${outBytesWithoutSignature.length})`
  );

  // Confirm the embedded image is actually present as an XObject in the page resources.
  // The template already ships 2 baked-in image XObjects (letterhead art), so an
  // "XObject dict non-empty" check alone would pass even without a signature. Instead,
  // compare XObject counts between the reloaded "without" and "with" signature docs and
  // require exactly one additional XObject key for the signature image.
  const reloadedDocWithoutSignature = await PDFLib.PDFDocument.load(outBytesWithoutSignature);
  const pageWithoutSignature = reloadedDocWithoutSignature.getPages()[0];
  const resourcesWithoutSignature = pageWithoutSignature.node.Resources();
  const xObjectsWithoutSignature = resourcesWithoutSignature.lookup(PDFLib.PDFName.of('XObject'));
  const xObjectCountWithoutSignature = xObjectsWithoutSignature ? xObjectsWithoutSignature.keys().length : 0;

  const reloadedDoc = await PDFLib.PDFDocument.load(outBytesWithSignature);
  const page = reloadedDoc.getPages()[0];
  const resources = page.node.Resources();
  const xObjects = resources.lookup(PDFLib.PDFName.of('XObject'));
  assert.ok(xObjects, 'no XObject dictionary found on page resources');
  assert.equal(
    xObjects.keys().length,
    xObjectCountWithoutSignature + 1,
    `expected exactly one additional XObject for the signature image (without=${xObjectCountWithoutSignature}, with=${xObjects.keys().length})`
  );
});

test('fillGuestAuthorizationForm places tower, unit, dates, and guest rows at the calibrated positions', async () => {
  const templateBytes = readFileSync(new URL('../templates/air-gaf.pdf', import.meta.url));
  const outBytes = await fillGuestAuthorizationForm(PDFLib, templateBytes, BUILDINGS.air.form, {
    tower: '1',
    unit: '965',
    periodFrom: 'Aug 27, 2026',
    periodTo: '29',
    guests: [
      { name: 'Michael Josh Serna', proofId: 'Passport', relationship: 'Friend' },
      { name: 'Jayson Lojera', proofId: 'Driver License', relationship: 'Friend' },
    ],
    givenDay: '27',
    givenMonth: 'August',
    givenYear: '26',
    ownerName: 'John Yves Araullo',
  });

  const doc = await pdfjsLib.getDocument({ data: outBytes }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const items = content.items.map((it) => ({ text: it.str, x: it.transform[4], y: it.transform[5] }));

  const guestItem = items.find((it) => it.text.includes('Michael Josh Serna'));
  assert.ok(guestItem, 'first guest row not found in filled PDF');
  assert.ok(Math.abs(guestItem.y - 588) < 2, `expected first guest row near y=588, got y=${guestItem.y}`);

  assert.ok(items.some((it) => it.text.includes('Jayson Lojera')), 'second guest row not found');
  assert.ok(items.some((it) => it.text.includes('Passport')), 'first guest proof-of-ID not found');
  assert.ok(items.some((it) => it.text.includes('Driver License')), 'second guest proof-of-ID not found');
  assert.ok(items.some((it) => it.text.includes('965')), 'unit not found');
  assert.ok(items.some((it) => it.text.includes('Aug 27, 2026')), 'period-from date not found');

  const ownerNameItem = items.find((it) => it.text.includes('John Yves Araullo'));
  assert.ok(ownerNameItem, 'owner name not found in filled PDF');
  // Regression guard for the owner-name/signature overlap bug: the name
  // must sit near the calibrated y=65, clearly below where the signature
  // box (y=70-98) starts, not crowded into the same few points as before.
  assert.ok(Math.abs(ownerNameItem.y - 65) < 2, `expected owner name near y=65, got y=${ownerNameItem.y}`);
});

test('fillGuestAuthorizationForm caps guest rows at 4 and embeds a signature image', async () => {
  const templateBytes = readFileSync(new URL('../templates/air-gaf.pdf', import.meta.url));
  const guests = [
    { name: 'Guest One', proofId: 'Passport', relationship: 'Friend' },
    { name: 'Guest Two', proofId: 'Passport', relationship: 'Friend' },
    { name: 'Guest Three', proofId: 'Passport', relationship: 'Friend' },
    { name: 'Guest Four', proofId: 'Passport', relationship: 'Friend' },
    { name: 'Guest Five (should not appear)', proofId: 'Passport', relationship: 'Friend' },
  ];
  const signaturePngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
    'base64'
  );

  const baseData = {
    tower: '1',
    unit: '965',
    periodFrom: 'Aug 27, 2026',
    periodTo: '29',
    guests,
    givenDay: '27',
    givenMonth: 'August',
    givenYear: '26',
    ownerName: 'John Yves Araullo',
  };

  const outBytesWithoutSignature = await fillGuestAuthorizationForm(PDFLib, templateBytes, BUILDINGS.air.form, baseData);
  const outBytes = await fillGuestAuthorizationForm(PDFLib, templateBytes, BUILDINGS.air.form, {
    ...baseData,
    signaturePngBytes,
  });

  // pdfjs-dist's getDocument() detaches/transfers the ArrayBuffer behind
  // whatever Uint8Array it's given (structured-clone-with-transfer to its
  // worker), so reloading the *same* outBytes afterward via pdf-lib's
  // PDFDocument.load() fails with "No PDF header found". Hand pdfjs a copy.
  const doc = await pdfjsLib.getDocument({ data: outBytes.slice() }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const text = content.items.map((it) => it.str).join(' ');

  assert.match(text, /Guest Four/);
  assert.doesNotMatch(text, /Guest Five/, 'a 5th guest should be dropped since the table only has 4 rows');

  // The template already ships baked-in logo images, so "XObject dict
  // non-empty" alone would pass even without a signature — compare counts
  // between the reloaded "without" and "with" signature docs instead, same
  // technique used for the Guest Information Sheet's equivalent test.
  const reloadedWithout = await PDFLib.PDFDocument.load(outBytesWithoutSignature);
  const resourcesWithout = reloadedWithout.getPages()[0].node.Resources();
  const xObjectsWithout = resourcesWithout.lookup(PDFLib.PDFName.of('XObject'));
  const countWithout = xObjectsWithout ? xObjectsWithout.keys().length : 0;

  const reloadedDoc = await PDFLib.PDFDocument.load(outBytes);
  const resources = reloadedDoc.getPages()[0].node.Resources();
  const xObjects = resources.lookup(PDFLib.PDFName.of('XObject'));
  assert.ok(xObjects, 'no XObject dictionary found on page resources');
  assert.equal(
    xObjects.keys().length,
    countWithout + 1,
    `expected exactly one additional XObject for the signature image (without=${countWithout}, with=${xObjects.keys().length})`
  );
});
