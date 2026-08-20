import { BUILDINGS } from './config.js';
import { loadDefaults, saveDefaults } from './signature-store.js';

const building = BUILDINGS.uptown;

const unitSelect = document.getElementById('unitSelect');
const ownerNameEl = document.getElementById('ownerName');
const ownerMobileEl = document.getElementById('ownerMobile');
const sigPad = document.getElementById('sigPad');
const sigCtx = sigPad.getContext('2d');
const clearSigBtn = document.getElementById('clearSigBtn');

let sigHasStrokes = false;

function populateUnits() {
  unitSelect.innerHTML = '';
  for (const unit of building.units) {
    const opt = document.createElement('option');
    opt.value = unit;
    opt.textContent = unit;
    unitSelect.appendChild(opt);
  }
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const rect = sigPad.getBoundingClientRect();
  sigPad.width = rect.width * ratio;
  sigPad.height = rect.height * ratio;
  sigCtx.scale(ratio, ratio);
  sigCtx.lineWidth = 2;
  sigCtx.lineCap = 'round';
  sigCtx.strokeStyle = '#1c2130';
}

function pointFromEvent(evt) {
  const rect = sigPad.getBoundingClientRect();
  const point = evt.touches ? evt.touches[0] : evt;
  return { x: point.clientX - rect.left, y: point.clientY - rect.top };
}

function attachSignaturePad() {
  let drawing = false;
  const start = (evt) => {
    drawing = true;
    sigHasStrokes = true;
    const { x, y } = pointFromEvent(evt);
    sigCtx.beginPath();
    sigCtx.moveTo(x, y);
    evt.preventDefault();
  };
  const move = (evt) => {
    if (!drawing) return;
    const { x, y } = pointFromEvent(evt);
    sigCtx.lineTo(x, y);
    sigCtx.stroke();
    evt.preventDefault();
  };
  const end = () => { drawing = false; };

  sigPad.addEventListener('mousedown', start);
  sigPad.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  sigPad.addEventListener('touchstart', start, { passive: false });
  sigPad.addEventListener('touchmove', move, { passive: false });
  sigPad.addEventListener('touchend', end);

  clearSigBtn.addEventListener('click', () => {
    sigCtx.clearRect(0, 0, sigPad.width, sigPad.height);
    sigHasStrokes = false;
  });
}

function signaturePngBytes() {
  if (!sigHasStrokes) return null;
  const dataUrl = sigPad.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function loadSavedDefaults() {
  const defaults = loadDefaults(window.localStorage);
  ownerNameEl.value = defaults.ownerName;
  ownerMobileEl.value = defaults.ownerMobile;
  if (defaults.unit && building.units.includes(defaults.unit)) unitSelect.value = defaults.unit;
}

function persistDefaults() {
  saveDefaults({
    ownerName: ownerNameEl.value,
    ownerMobile: ownerMobileEl.value,
    unit: unitSelect.value,
    signaturePngDataUrl: sigHasStrokes ? sigPad.toDataURL('image/png') : '',
  }, window.localStorage);
}

import { missingGuestIds } from './fields.js';

const companionsList = document.getElementById('companionsList');
const addCompanionBtn = document.getElementById('addCompanionBtn');
const registeredGuestEl = document.getElementById('registeredGuest');
const registeredGuestIdEl = document.getElementById('registeredGuestId');

function addCompanionRow() {
  const row = document.createElement('div');
  row.className = 'companion-row';
  row.innerHTML = `
    <input type="text" placeholder="Companion name" class="companion-name">
    <input type="file" accept="image/*" capture="environment" class="companion-id">
    <button class="btn small" type="button" aria-label="Remove">✕</button>
  `;
  row.querySelector('button').addEventListener('click', () => row.remove());
  companionsList.appendChild(row);
}

addCompanionBtn.addEventListener('click', addCompanionRow);

function collectGuests() {
  const guests = [{
    name: registeredGuestEl.value.trim(),
    hasId: !!(registeredGuestIdEl.files && registeredGuestIdEl.files[0]),
  }];
  companionsList.querySelectorAll('.companion-row').forEach((row) => {
    const name = row.querySelector('.companion-name').value.trim();
    if (!name) return; // an empty companion row is just unused, not a validation error
    const hasId = !!(row.querySelector('.companion-id').files[0]);
    guests.push({ name, hasId });
  });
  return guests;
}

function collectCompanionNames() {
  return Array.from(companionsList.querySelectorAll('.companion-name'))
    .map((el) => el.value.trim())
    .filter(Boolean);
}

function collectAllIdFiles() {
  const files = [];
  if (registeredGuestIdEl.files[0]) files.push(registeredGuestIdEl.files[0]);
  companionsList.querySelectorAll('.companion-id').forEach((input) => {
    if (input.files[0]) files.push(input.files[0]);
  });
  return files;
}

populateUnits();
resizeCanvas();
attachSignaturePad();
loadSavedDefaults();
ownerNameEl.addEventListener('change', persistDefaults);
ownerMobileEl.addEventListener('change', persistDefaults);
unitSelect.addEventListener('change', persistDefaults);
