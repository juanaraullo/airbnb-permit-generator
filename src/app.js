import { BUILDINGS } from './config.js';
import { loadDefaults, saveDefaults } from './signature-store.js';

const building = BUILDINGS.uptown;

const unitSelect = document.getElementById('unitSelect');
const ownerNameEl = document.getElementById('ownerName');
const ownerMobileEl = document.getElementById('ownerMobile');
const sigPad = document.getElementById('sigPad');
const sigCtx = sigPad.getContext('2d');
const clearSigBtn = document.getElementById('clearSigBtn');
const uploadSigBtn = document.getElementById('uploadSigBtn');
const sigUpload = document.getElementById('sigUpload');

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

// Resizes the canvas's backing bitmap to match its current CSS size at the
// display's pixel ratio. Only actually touches the bitmap (which the canvas
// spec always clears on any width/height assignment, even to an unchanged
// value) when the target size has genuinely changed, so callers can tell
// whether anything was actually reset. Returns true if it resized.
function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const rect = sigPad.getBoundingClientRect();
  const targetWidth = Math.round(rect.width * ratio);
  const targetHeight = Math.round(rect.height * ratio);
  if (sigPad.width === targetWidth && sigPad.height === targetHeight) return false;
  sigPad.width = targetWidth;
  sigPad.height = targetHeight;
  sigCtx.scale(ratio, ratio);
  sigCtx.lineWidth = 2;
  sigCtx.lineCap = 'round';
  sigCtx.strokeStyle = '#1c2130';
  sigHasStrokes = false;
  return true;
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

  uploadSigBtn.addEventListener('click', () => sigUpload.click());
  sigUpload.addEventListener('change', () => {
    const file = sigUpload.files[0];
    if (file) loadSignatureImageFile(file);
  });
}

// Draws an uploaded signature image onto the pad, scaled to fit while
// preserving aspect ratio, so a host can use a consistent pre-made
// e-signature instead of redrawing one by hand each time.
function loadSignatureImageFile(file) {
  const reader = new FileReader();
  reader.onerror = () => {
    genStatus.textContent = 'Could not read that signature image — please try a different file.';
    genStatus.className = 'status err';
  };
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => {
      genStatus.textContent = 'That file doesn\'t look like a valid image — please try a different one.';
      genStatus.className = 'status err';
    };
    img.onload = () => {
      const ratio = window.devicePixelRatio || 1;
      const boxW = sigPad.width / ratio;
      const boxH = sigPad.height / ratio;
      sigCtx.clearRect(0, 0, boxW, boxH);
      const scale = Math.min(boxW / img.width, boxH / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      sigCtx.drawImage(img, (boxW - w) / 2, (boxH - h) / 2, w, h);
      sigHasStrokes = true;
      invalidateGeneratedPdf();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  sigUpload.value = '';
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
const houseRulesPhotoEl = document.getElementById('houseRulesPhoto');

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
    <input type="file" accept="image/*" class="companion-id">
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
const copyBodyBtn = document.getElementById('copyBodyBtn');

let lastEmailBody = '';

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

  if (!houseRulesPhotoEl.files[0]) {
    sendStatus.textContent = 'Please attach a photo of the signed house rules.';
    sendStatus.className = 'status err';
    return;
  }

  const stayFromLong = formatDateLong(parseIsoDateLocal(stayFromEl.value));
  const stayToLong = formatDateLong(parseIsoDateLocal(stayToEl.value));

  const subject = buildEmailSubject({
    subjectCode: building.subjectCode,
    unit: unitSelect.value,
    stayFromLong,
    stayToLong,
  });
  const body = buildEmailBody({
    ownerName: ownerNameEl.value.trim(),
    ownerMobile: ownerMobileEl.value.trim(),
    unit: unitSelect.value,
    buildingName: `${building.name} ${building.tower}`,
    stayFromLong,
    stayToLong,
    guestNames: guests.map((g) => g.name),
  });

  adminEmailText.textContent = building.adminEmail;
  subjectText.textContent = subject;
  lastEmailBody = body;
  emailBox.style.display = '';

  const attachments = [...collectAllIdFiles(), houseRulesPhotoEl.files[0]];

  if (canShareFiles(navigator)) {
    // Some mail apps' iOS share extensions (observed with Gmail) ignore the
    // Web Share API's `title` and instead auto-fill the email subject from
    // the shared PDF's own filename. Naming the shared file after the
    // subject itself makes that fallback behavior produce the right
    // subject too, without affecting the separate, human-friendly filename
    // used for the direct-download link/fallback path below.
    const sharePdfFile = new File([lastFilledPdfBytes], `${subject}.pdf`, { type: 'application/pdf' });
    try {
      await navigator.share({ files: [sharePdfFile, ...attachments], title: subject, text: body });
      sendStatus.textContent = 'Shared. Pick Mail, then paste in the subject/recipient shown below.';
    } catch (err) {
      if (err.name !== 'AbortError') {
        sendStatus.textContent = 'Share failed: ' + err.message;
        sendStatus.className = 'status err';
      }
    }
  } else {
    downloadFile(lastFilledPdfBytes, lastFilledFilename);
    attachments.forEach((file) => downloadFile(file, file.name));
    window.location.href = buildMailtoUrl({ to: building.adminEmail, subject, body });
    sendStatus.textContent = 'Downloaded the PDF, ID photos, and house rules photo, and opened a Mail draft — attach the downloaded files.';
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
copyBodyBtn.addEventListener('click', () => navigator.clipboard.writeText(lastEmailBody));

populateUnits();
// Defer the initial measurement two frames so it runs after the browser's
// first layout pass has settled — measuring immediately can catch the
// canvas mid-layout (e.g. during a container/viewport still resizing) and
// permanently lock in a too-small drawing buffer, since there's no other
// trigger to re-measure until a later window resize.
requestAnimationFrame(() => requestAnimationFrame(resizeCanvas));
attachSignaturePad();
loadSavedDefaults();
ownerNameEl.addEventListener('change', persistDefaults);
ownerMobileEl.addEventListener('change', persistDefaults);
unitSelect.addEventListener('change', persistDefaults);
registeredGuestEl.addEventListener('input', invalidateGeneratedPdf);
stayFromEl.addEventListener('input', invalidateGeneratedPdf);
stayToEl.addEventListener('input', invalidateGeneratedPdf);
unitSelect.addEventListener('input', invalidateGeneratedPdf);
ownerNameEl.addEventListener('input', invalidateGeneratedPdf);
addCompanionRow();

let resizeDebounce;
window.addEventListener('resize', () => {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(() => {
    // Only wipe an in-progress signature / invalidate a generated PDF when
    // the canvas's drawable size actually changed — many resize events
    // (on-screen keyboard opening, a mobile browser's address bar hiding,
    // DevTools panel toggling) don't change sigPad's width and shouldn't
    // discard a signature the host already drew.
    if (resizeCanvas()) {
      invalidateGeneratedPdf();
    }
  }, 200);
});
