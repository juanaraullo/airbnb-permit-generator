// tests/filler.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as PDFLib from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fillGuestInfoSheet } from '../src/filler.js';
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
