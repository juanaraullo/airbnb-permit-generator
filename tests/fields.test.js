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

test('buildFilename includes unit and stay date, ends in .png', () => {
  const name = buildFilename({ unit: '24J', stayFromIso: '2026-08-20' });
  assert.equal(name, 'Guest Info Sheet - Unit 24J - 2026-08-20.png');
});

test('buildEmailSubject follows the "CODE; room unit; from-to" format', () => {
  const subject = buildEmailSubject({
    subjectCode: 'UPS T2',
    unit: '24J',
    stayFromLong: 'Aug 25, 2026',
    stayToLong: 'Aug 30, 2026',
  });
  assert.equal(subject, 'UPS T2; room 24J; Aug 25, 2026-Aug 30, 2026');
});

test('buildEmailBody includes stay dates, host contact, and a numbered guest list', () => {
  const body = buildEmailBody({
    ownerName: 'Juan Araullo',
    ownerMobile: '0917 000 0000',
    unit: '24J',
    buildingName: 'Uptown Parksuites Tower 2',
    stayFromLong: 'Aug 20, 2026',
    stayToLong: 'Aug 25, 2026',
    guestNames: ['Juan Dela Cruz', 'Maria Santos'],
  });
  assert.match(body, /Unit 24J, Uptown Parksuites Tower 2/);
  assert.match(body, /Aug 20, 2026 to Aug 25, 2026/);
  assert.match(body, /Juan Araullo/);
  assert.match(body, /0917 000 0000/);
  assert.equal(
    body,
    "Hi,\r\n\r\nPlease find attached the Guest Information Sheet for Unit 24J, Uptown Parksuites Tower 2, along with the guests' valid IDs and signed house rules.\r\n\r\nGuests: \r\n\r\n1. Juan Dela Cruz\r\n2. Maria Santos\r\n\r\n\r\nStay: Aug 20, 2026 to Aug 25, 2026\r\n\r\nThank you,\r\nJuan Araullo\r\n0917 000 0000"
  );
});

test('attachmentsShortfall requires one photo per guest plus one for house rules', () => {
  assert.equal(attachmentsShortfall(2, 3), 0); // exactly enough (2 guests + 1 house rules)
  assert.equal(attachmentsShortfall(2, 5), 0); // more than enough
  assert.equal(attachmentsShortfall(2, 1), 2); // 2 short
  assert.equal(attachmentsShortfall(1, 0), 2); // 0 photos, 1 guest -> need 2
  assert.equal(attachmentsShortfall(0, 0), 1); // no guests, still need house rules
});
