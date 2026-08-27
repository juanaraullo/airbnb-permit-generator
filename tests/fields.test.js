import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateLong,
  parseIsoDateLocal,
  buildFilename,
  buildEmailSubject,
  buildEmailBody,
  attachmentsShortfall,
} from '../src/fields.js';

test('formatDateLong renders a human date', () => {
  assert.equal(formatDateLong(new Date(2026, 7, 20)), 'Aug 20, 2026');
});

test('parseIsoDateLocal avoids UTC day-shift', () => {
  const d = parseIsoDateLocal('2026-08-20');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 7);
  assert.equal(d.getDate(), 20);
});

test('buildFilename includes doc title, unit, and stay date, ends in the given extension', () => {
  const pngName = buildFilename({ docTitle: 'Guest Info Sheet', unit: '24J', stayFromIso: '2026-08-20', extension: 'png' });
  assert.equal(pngName, 'Guest Info Sheet - Unit 24J - 2026-08-20.png');
  const pdfName = buildFilename({ docTitle: 'Guest Authorization Form', unit: '965', stayFromIso: '2026-08-20', extension: 'pdf' });
  assert.equal(pdfName, 'Guest Authorization Form - Unit 965 - 2026-08-20.pdf');
});

test('buildEmailSubject substitutes {unit} and {dates} into the building-specific template', () => {
  const uptownSubject = buildEmailSubject({
    subjectTemplate: 'UPS T2; room {unit}; {dates}',
    unit: '24J',
    stayFromLong: 'Aug 25, 2026',
    stayToLong: 'Aug 30, 2026',
  });
  assert.equal(uptownSubject, 'UPS T2; room 24J; Aug 25, 2026-Aug 30, 2026');

  const airSubject = buildEmailSubject({
    subjectTemplate: 'AIR {unit} GAF ; {dates}',
    unit: '965',
    stayFromLong: 'Aug 25, 2026',
    stayToLong: 'Aug 30, 2026',
  });
  assert.equal(airSubject, 'AIR 965 GAF ; Aug 25, 2026-Aug 30, 2026');
});

test('buildEmailBody mentions house rules when the building requires a separate photo', () => {
  const body = buildEmailBody({
    ownerName: 'Juan Araullo',
    ownerMobile: '0917 000 0000',
    unit: '24J',
    buildingName: 'Uptown Parksuites Tower 2',
    docTitle: 'Guest Information Sheet',
    stayFromLong: 'Aug 20, 2026',
    stayToLong: 'Aug 25, 2026',
    guestNames: ['Juan Dela Cruz', 'Maria Santos'],
    requiresHouseRulesPhoto: true,
  });
  assert.equal(
    body,
    "Hi,\r\n\r\nPlease find attached the Guest Information Sheet for Unit 24J, Uptown Parksuites Tower 2, along with the guests' valid IDs and signed house rules.\r\n\r\nGuests: \r\n\r\n1. Juan Dela Cruz\r\n2. Maria Santos\r\n\r\n\r\nStay: Aug 20, 2026 to Aug 25, 2026\r\n\r\nThank you,\r\nJuan Araullo\r\n0917 000 0000"
  );
});

test('buildEmailBody omits house rules mention when the building does not require a separate photo', () => {
  const body = buildEmailBody({
    ownerName: 'Juan Araullo',
    ownerMobile: '0917 000 0000',
    unit: '965',
    buildingName: 'Air Residences',
    docTitle: 'Guest Authorization Form',
    stayFromLong: 'Aug 20, 2026',
    stayToLong: 'Aug 25, 2026',
    guestNames: ['Juan Dela Cruz'],
    requiresHouseRulesPhoto: false,
  });
  assert.match(body, /along with the guests' valid IDs\.\r\n/);
  assert.doesNotMatch(body, /house rules/);
});

test('attachmentsShortfall requires one photo per guest, plus one more only if house rules photo is required', () => {
  assert.equal(attachmentsShortfall(2, 3, true), 0); // exactly enough (2 guests + 1 house rules)
  assert.equal(attachmentsShortfall(2, 5, true), 0); // more than enough
  assert.equal(attachmentsShortfall(2, 1, true), 2); // 2 short
  assert.equal(attachmentsShortfall(1, 0, true), 2); // 0 photos, 1 guest -> need 2
  assert.equal(attachmentsShortfall(0, 0, true), 1); // no guests, still need house rules
  assert.equal(attachmentsShortfall(2, 2, false), 0); // no house rules required: 2 guests, 2 photos is enough
  assert.equal(attachmentsShortfall(2, 1, false), 1); // no house rules required: still 1 short
  assert.equal(attachmentsShortfall(0, 0, false), 0); // no guests, no house rules -> nothing needed
});
