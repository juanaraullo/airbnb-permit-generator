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
