import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS } from '../src/config.js';

test('uptown building has the expected shape', () => {
  const uptown = BUILDINGS.uptown;
  assert.equal(uptown.name, 'Uptown Parksuites');
  assert.equal(uptown.tower, 'Tower 2');
  assert.equal(uptown.displayName, 'Uptown Parksuites Tower 2');
  assert.equal(uptown.subjectTemplate, 'UPS T2; room {unit}; {dates}');
  assert.equal(uptown.requiresHouseRulesPhoto, true);
  assert.deepEqual(uptown.units, ['24J', '8T']);
  assert.equal(uptown.adminEmail, 'clientcare.uptownparksuites@asia-affinity.com');
  assert.equal(uptown.form.docType, 'guestInfoSheet');
  assert.equal(uptown.form.template, 'templates/uptown-guest-info.pdf');
  assert.equal(uptown.form.maxGuests, 6);
});

test('uptown field coordinates match the calibrated values', () => {
  const f = BUILDINGS.uptown.form.fields;
  assert.deepEqual(f.registeredGuest, { x: 197, y: 855, size: 10 });
  assert.deepEqual(f.companionRows, { x: 90, startY: 563, rowH: 19, max: 5, size: 9 });
  assert.deepEqual(f.signature, { x: 195, y: 256, w: 225, h: 26 });
});

test('air building has the expected shape', () => {
  const air = BUILDINGS.air;
  assert.equal(air.name, 'Air Residences');
  assert.equal(air.tower, '1');
  assert.equal(air.displayName, 'Air Residences');
  assert.equal(air.subjectTemplate, 'AIR {unit} GAF ; {dates}');
  assert.equal(air.requiresHouseRulesPhoto, false);
  assert.deepEqual(air.units, ['965', '1116', '2510', '3024', '4061', '4841']);
  assert.equal(air.adminEmail, 'air.admin@greenmist.ph');
  assert.equal(air.form.docType, 'guestAuthorizationForm');
  assert.equal(air.form.template, 'templates/air-gaf-blank.png');
  assert.equal(air.form.maxGuests, 4);
});

test('air field coordinates match the calibrated values', () => {
  const f = BUILDINGS.air.form.fields;
  assert.deepEqual(f.guestRows, { nameX: 128, proofIdX: 405, relationshipX: 483, startY: 588, rowH: 21, max: 4, size: 8 });
  assert.deepEqual(f.signature, { x: 365, y: 70, w: 155, h: 28 });
  assert.deepEqual(f.ownerName, { x: 400, y: 65, size: 8 });
  // size is shrunk from the printed form's default so a 4-digit unit (e.g.
  // "4061") doesn't run into the printed "for" label ~18pt to its right.
  assert.deepEqual(f.unit, { x: 483, y: 659, size: 6.5 });
  // x is nudged past the printed ",20" (which spans x=237-249) so the
  // 2-digit year doesn't draw on top of it.
  assert.deepEqual(f.givenYear, { x: 250, y: 79, size: 7 });
});
