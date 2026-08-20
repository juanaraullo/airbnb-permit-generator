import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS } from '../src/config.js';

test('uptown building has the expected shape', () => {
  const uptown = BUILDINGS.uptown;
  assert.equal(uptown.name, 'Uptown Parksuites');
  assert.equal(uptown.tower, 'Tower 2');
  assert.equal(uptown.subjectCode, 'UPS T2');
  assert.deepEqual(uptown.units, ['24J', '8T']);
  assert.equal(uptown.adminEmail, 'clientcare.uptownparksuites@asia-affinity.com');
  assert.equal(uptown.form.template, 'templates/uptown-guest-info.pdf');
});

test('uptown field coordinates match the calibrated values', () => {
  const f = BUILDINGS.uptown.form.fields;
  assert.deepEqual(f.registeredGuest, { x: 197, y: 855, size: 10 });
  assert.deepEqual(f.companionRows, { x: 90, startY: 563, rowH: 19, max: 5, size: 9 });
  assert.deepEqual(f.signature, { x: 195, y: 256, w: 225, h: 26 });
});
