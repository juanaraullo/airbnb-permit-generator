import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDefaults, saveDefaults } from '../src/signature-store.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

test('loadDefaults returns empty defaults when nothing saved', () => {
  const defaults = loadDefaults(fakeStorage());
  assert.deepEqual(defaults, { ownerName: '', ownerMobile: '', unit: '', signaturePngDataUrl: '' });
});

test('saveDefaults then loadDefaults round-trips', () => {
  const storage = fakeStorage();
  saveDefaults({ ownerName: 'Juan Araullo', ownerMobile: '0917', unit: '24J', signaturePngDataUrl: 'data:image/png;base64,x' }, storage);
  const loaded = loadDefaults(storage);
  assert.equal(loaded.ownerName, 'Juan Araullo');
  assert.equal(loaded.unit, '24J');
});

test('loadDefaults recovers from corrupted stored JSON', () => {
  const storage = fakeStorage();
  storage.setItem('airbnb-permit-generator:defaults', '{not json');
  const loaded = loadDefaults(storage);
  assert.deepEqual(loaded, { ownerName: '', ownerMobile: '', unit: '', signaturePngDataUrl: '' });
});

test('saveDefaults does not throw when storage.setItem fails', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('quota exceeded'); } };
  assert.doesNotThrow(() => saveDefaults({ ownerName: 'x', ownerMobile: '', unit: '', signaturePngDataUrl: '' }, storage));
});
