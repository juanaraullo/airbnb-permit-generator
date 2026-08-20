import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canShareFiles, buildMailtoUrl } from '../src/share.js';

test('canShareFiles is true when navigator supports file sharing', () => {
  const nav = { share: () => Promise.resolve(), canShare: () => true };
  assert.equal(canShareFiles(nav), true);
});

test('canShareFiles is false when share/canShare are missing', () => {
  assert.equal(canShareFiles({}), false);
  assert.equal(canShareFiles(undefined), false);
});

test('canShareFiles is false when canShare rejects files', () => {
  const nav = { share: () => {}, canShare: () => false };
  assert.equal(canShareFiles(nav), false);
});

test('canShareFiles is false when canShare throws', () => {
  const nav = { share: () => {}, canShare: () => { throw new Error('nope'); } };
  assert.equal(canShareFiles(nav), false);
});

test('buildMailtoUrl percent-encodes subject and body', () => {
  const url = buildMailtoUrl({ to: 'admin@example.com', subject: 'A & B', body: 'Line 1\nLine 2' });
  assert.equal(
    url,
    'mailto:admin%40example.com?subject=A%20%26%20B&body=Line%201%0ALine%202'
  );
});
