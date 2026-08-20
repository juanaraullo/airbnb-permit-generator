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
    invalidateGeneratedPdf();
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
    invalidateGeneratedPdf();
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

import { missingGuestIds, formatDateLong, parseIsoDateLocal, buildFilename, buildEmailSubject, buildEmailBody } from './fields.js';

const companionsList = document.getElementById('companionsList');
const addCompanionBtn = document.getElementById('addCompanionBtn');
const registeredGuestEl = document.getElementById('registeredGuest');
const registeredGuestIdEl = document.getElementById('registeredGuestId');

const MAX_COMPANION_ROWS = 5;

function updateAddCompanionBtnState() {
  addCompanionBtn.disabled = companionsList.querySelectorAll('.companion-row').length >= MAX_COMPANION_ROWS;
}

function addCompanionRow() {
  if (companionsList.querySelectorAll('.companion-row').length >= MAX_COMPANION_ROWS) {
    updateAddCompanionBtnState();
    return;
  }
  const row = document.createElement('div');
  row.className = 'companion-row';
  row.innerHTML = `
    <input type="text" placeholder="Companion name" class="companion-name">
    <input type="file" accept="image/*" capture="environment" class="companion-id">
    <button class="btn small" type="button" aria-label="Remove">✕</button>
  `;
  row.querySelector('button').addEventListener('click', () => {
    row.remove();
    updateAddCompanionBtnState();
    invalidateGeneratedPdf();
  });
  companionsList.appendChild(row);
  updateAddCompanionBtnState();
  invalidateGeneratedPdf();
}

addCompanionBtn.addEventListener('click', addCompanionRow);
companionsList.addEventListener('input', (evt) => {
  if (evt.target.classList.contains('companion-name')) invalidateGeneratedPdf();
});

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

import { fillGuestInfoSheet } from './filler.js';
import { canShareFiles, buildMailtoUrl } from './share.js';

const stayFromEl = document.getElementById('stayFrom');
const stayToEl = document.getElementById('stayTo');
const generateBtn = document.getElementById('generateBtn');
const genStatus = document.getElementById('genStatus');
const pdfDownloadLink = document.getElementById('pdfDownloadLink');
const sendBtn = document.getElementById('sendBtn');

let lastFilledPdfBytes = null;
let lastFilledFilename = '';
let currentPdfUrl = null;

function invalidateGeneratedPdf() {
  lastFilledPdfBytes = null;
  lastFilledFilename = '';
  sendBtn.disabled = true;
  pdfDownloadLink.style.display = 'none';
}

async function generate() {
  genStatus.textContent = '';
  genStatus.className = 'status';
  sendBtn.disabled = true;

  if (!registeredGuestEl.value.trim() || !stayFromEl.value || !stayToEl.value) {
    genStatus.textContent = 'Guest name and both stay dates are required.';
    genStatus.className = 'status err';
    return;
  }
  const sigBytes = signaturePngBytes();
  if (!sigBytes) {
    genStatus.textContent = 'Please draw your signature first.';
    genStatus.className = 'status err';
    return;
  }

  const templateResp = await fetch(building.form.template);
  const templateBytes = new Uint8Array(await templateResp.arrayBuffer());

  const stayFromLong = formatDateLong(parseIsoDateLocal(stayFromEl.value));
  const stayToLong = formatDateLong(parseIsoDateLocal(stayToEl.value));

  const outBytes = await fillGuestInfoSheet(window.PDFLib, templateBytes, building.form, {
    registeredGuest: registeredGuestEl.value.trim(),
    stayFrom: stayFromLong,
    stayTo: stayToLong,
    tower: building.tower,
    unit: unitSelect.value,
    ownerName: ownerNameEl.value.trim(),
    dateSigned: formatDateLong(new Date()),
    companions: collectCompanionNames(),
    signaturePngBytes: sigBytes,
  });

  lastFilledPdfBytes = outBytes;
  lastFilledFilename = buildFilename({ unit: unitSelect.value, stayFromIso: stayFromEl.value });

  if (currentPdfUrl) {
    URL.revokeObjectURL(currentPdfUrl);
  }
  const blob = new Blob([outBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  currentPdfUrl = url;
  pdfDownloadLink.href = url;
  pdfDownloadLink.download = lastFilledFilename;
  pdfDownloadLink.style.display = '';

  genStatus.textContent = `Generated "${lastFilledFilename}".`;
  persistDefaults();
  sendBtn.disabled = false;
}

generateBtn.addEventListener('click', () => {
  generate().catch((err) => {
    genStatus.textContent = 'Something went wrong generating the PDF: ' + err.message;
    genStatus.className = 'status err';
  });
});

const sendStatus = document.getElementById('sendStatus');
const emailBox = document.getElementById('emailBox');
const adminEmailText = document.getElementById('adminEmailText');
const subjectText = document.getElementById('subjectText');
const copyAdminEmailBtn = document.getElementById('copyAdminEmailBtn');
const copySubjectBtn = document.getElementById('copySubjectBtn');

function downloadFile(bytesOrFile, filename) {
  const blob = bytesOrFile instanceof Blob ? bytesOrFile : new Blob([bytesOrFile], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function send() {
  sendStatus.textContent = '';
  sendStatus.className = 'status';

  if (!lastFilledPdfBytes) {
    sendStatus.textContent = 'Generate the permit first.';
    sendStatus.className = 'status err';
    return;
  }

  if (!registeredGuestEl.value.trim() || !stayFromEl.value || !stayToEl.value) {
    sendStatus.textContent = 'Guest name and both stay dates are required.';
    sendStatus.className = 'status err';
    return;
  }

  const guests = collectGuests();
  const missing = missingGuestIds(guests);
  if (missing.length) {
    sendStatus.textContent = `Missing ID photo for: ${missing.join(', ')}.`;
    sendStatus.className = 'status err';
    return;
  }

  const subject = buildEmailSubject({ unit: unitSelect.value, registeredGuest: registeredGuestEl.value.trim() });
  const body = buildEmailBody({
    ownerName: ownerNameEl.value.trim(),
    ownerMobile: ownerMobileEl.value.trim(),
    unit: unitSelect.value,
    buildingName: building.name,
    stayFromLong: formatDateLong(parseIsoDateLocal(stayFromEl.value)),
    stayToLong: formatDateLong(parseIsoDateLocal(stayToEl.value)),
  });

  adminEmailText.textContent = building.adminEmail;
  subjectText.textContent = subject;
  emailBox.style.display = '';

  const idFiles = collectAllIdFiles();
  const pdfFile = new File([lastFilledPdfBytes], lastFilledFilename, { type: 'application/pdf' });

  if (canShareFiles(navigator)) {
    try {
      await navigator.share({ files: [pdfFile, ...idFiles], title: subject, text: body });
      sendStatus.textContent = 'Shared. Pick Mail, then paste in the subject/recipient shown below.';
    } catch (err) {
      if (err.name !== 'AbortError') {
        sendStatus.textContent = 'Share failed: ' + err.message;
        sendStatus.className = 'status err';
      }
    }
  } else {
    downloadFile(pdfFile, lastFilledFilename);
    idFiles.forEach((file) => downloadFile(file, file.name));
    window.location.href = buildMailtoUrl({ to: building.adminEmail, subject, body });
    sendStatus.textContent = 'Downloaded the PDF and ID photos, and opened a Mail draft — attach the downloaded files.';
  }
}

sendBtn.addEventListener('click', () => {
  send().catch((err) => {
    sendStatus.textContent = 'Something went wrong: ' + err.message;
    sendStatus.className = 'status err';
  });
});

copyAdminEmailBtn.addEventListener('click', () => navigator.clipboard.writeText(building.adminEmail));
copySubjectBtn.addEventListener('click', () => navigator.clipboard.writeText(subjectText.textContent));

populateUnits();
resizeCanvas();
attachSignaturePad();
loadSavedDefaults();
ownerNameEl.addEventListener('change', persistDefaults);
ownerMobileEl.addEventListener('change', persistDefaults);
unitSelect.addEventListener('change', persistDefaults);
registeredGuestEl.addEventListener('input', invalidateGeneratedPdf);
stayFromEl.addEventListener('input', invalidateGeneratedPdf);
stayToEl.addEventListener('input', invalidateGeneratedPdf);
unitSelect.addEventListener('input', invalidateGeneratedPdf);
addCompanionRow();
