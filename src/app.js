import { BUILDINGS } from './config.js';
import { loadDefaults, saveDefaults } from './signature-store.js';

let buildingKey = 'uptown';
let building = BUILDINGS[buildingKey];

const buildingSelectEl = document.getElementById('buildingSelect');
const buildingSubtitleEl = document.getElementById('buildingSubtitle');
const unitSelect = document.getElementById('unitSelect');
const ownerNameEl = document.getElementById('ownerName');
const ownerMobileEl = document.getElementById('ownerMobile');
const sigPad = document.getElementById('sigPad');
const sigCtx = sigPad.getContext('2d');
const clearSigBtn = document.getElementById('clearSigBtn');
const uploadSigBtn = document.getElementById('uploadSigBtn');
const sigUpload = document.getElementById('sigUpload');

let sigHasStrokes = false;

function populateBuildingSelect() {
  buildingSelectEl.innerHTML = '';
  for (const [key, b] of Object.entries(BUILDINGS)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = b.name;
    buildingSelectEl.appendChild(opt);
  }
  buildingSelectEl.value = buildingKey;
}

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
    invalidateGeneratedPermit();
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
    invalidateGeneratedPermit();
  });

  uploadSigBtn.addEventListener('click', () => sigUpload.click());
  sigUpload.addEventListener('change', () => {
    const file = sigUpload.files[0];
    if (file) loadSignatureImageFile(file);
  });
}

// Draws a signature image onto the pad, scaled to fit while preserving
// aspect ratio. Shared by the manual upload flow and by restoring a
// previously saved signature on page load.
function drawSignatureImage(img) {
  const ratio = window.devicePixelRatio || 1;
  const boxW = sigPad.width / ratio;
  const boxH = sigPad.height / ratio;
  sigCtx.clearRect(0, 0, boxW, boxH);
  const scale = Math.min(boxW / img.width, boxH / img.height, 1);
  const w = img.width * scale;
  const h = img.height * scale;
  sigCtx.drawImage(img, (boxW - w) / 2, (boxH - h) / 2, w, h);
  sigHasStrokes = true;
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
      drawSignatureImage(img);
      invalidateGeneratedPermit();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  sigUpload.value = '';
}

// Restores a signature saved from a previous session (drawn or uploaded)
// so a host doesn't have to re-sign on every visit — once registered, it
// stays registered until they hit Clear.
function restoreSavedSignature(dataUrl) {
  const img = new Image();
  img.onload = () => drawSignatureImage(img);
  img.src = dataUrl;
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

// Signature restoration is deferred until after the canvas has been sized
// (see the init block at the bottom of this file) — drawing into it any
// earlier would be wiped out by that first resize.
let pendingSignatureDataUrl = '';

function loadSavedDefaults() {
  const defaults = loadDefaults(window.localStorage);
  ownerNameEl.value = defaults.ownerName;
  ownerMobileEl.value = defaults.ownerMobile;
  if (defaults.buildingKey && BUILDINGS[defaults.buildingKey]) {
    setBuilding(defaults.buildingKey, { resetGuests: false });
  }
  if (defaults.unit && building.units.includes(defaults.unit)) unitSelect.value = defaults.unit;
  pendingSignatureDataUrl = defaults.signaturePngDataUrl || '';
}

function persistDefaults() {
  saveDefaults({
    ownerName: ownerNameEl.value,
    ownerMobile: ownerMobileEl.value,
    unit: unitSelect.value,
    signaturePngDataUrl: sigHasStrokes ? sigPad.toDataURL('image/png') : '',
    buildingKey,
  }, window.localStorage);
}

import { attachmentsShortfall, formatDateLong, parseIsoDateLocal, buildFilename, buildEmailSubject, buildEmailBody } from './fields.js';

const companionsList = document.getElementById('companionsList');
const addCompanionBtn = document.getElementById('addCompanionBtn');
const registeredGuestEl = document.getElementById('registeredGuest');
const registeredGuestExtraEl = document.getElementById('registeredGuestExtra');
const registeredGuestProofIdEl = document.getElementById('registeredGuestProofId');
const registeredGuestRelationshipEl = document.getElementById('registeredGuestRelationship');
const attachmentsInputEl = document.getElementById('attachmentsInput');
const attachmentsSummaryEl = document.getElementById('attachmentsSummary');
const attachmentsLabelEl = document.getElementById('attachmentsLabel');

function updateAttachmentsSummary() {
  const count = attachmentsInputEl.files.length;
  attachmentsSummaryEl.textContent = count
    ? `${count} photo${count === 1 ? '' : 's'} selected.`
    : '';
}
attachmentsInputEl.addEventListener('change', updateAttachmentsSummary);

function isGuestAuthorizationForm() {
  return building.form.docType === 'guestAuthorizationForm';
}

function maxCompanionRows() {
  return building.form.maxGuests - 1;
}

function updateAddCompanionBtnState() {
  addCompanionBtn.disabled = companionsList.querySelectorAll('.companion-row').length >= maxCompanionRows();
}

function addCompanionRow() {
  if (companionsList.querySelectorAll('.companion-row').length >= maxCompanionRows()) {
    updateAddCompanionBtnState();
    return;
  }
  const row = document.createElement('div');
  row.className = 'companion-row';
  row.innerHTML = isGuestAuthorizationForm()
    ? `
      <input type="text" placeholder="Companion name" class="companion-name">
      <input type="text" placeholder="Proof of ID" class="companion-proofid">
      <input type="text" placeholder="Relationship" class="companion-relationship">
      <button class="btn small" type="button" aria-label="Remove">✕</button>
    `
    : `
      <input type="text" placeholder="Companion name" class="companion-name">
      <button class="btn small" type="button" aria-label="Remove">✕</button>
    `;
  row.querySelector('button').addEventListener('click', () => {
    row.remove();
    updateAddCompanionBtnState();
    invalidateGeneratedPermit();
  });
  companionsList.appendChild(row);
  updateAddCompanionBtnState();
  invalidateGeneratedPermit();
}

addCompanionBtn.addEventListener('click', addCompanionRow);
companionsList.addEventListener('input', (evt) => {
  if (evt.target.matches('.companion-name, .companion-proofid, .companion-relationship')) invalidateGeneratedPermit();
});

function collectCompanionNames() {
  return Array.from(companionsList.querySelectorAll('.companion-name'))
    .map((el) => el.value.trim())
    .filter(Boolean);
}

function collectGuestNames() {
  const name = registeredGuestEl.value.trim();
  return name ? [name, ...collectCompanionNames()] : collectCompanionNames();
}

// Full guest details (name + proof of ID + relationship) for buildings whose
// document needs all three per guest, with the registered guest treated as
// just the first row — the Guest Authorization Form has no special
// "primary guest" distinction, it's one flat table of up to maxGuests rows.
function collectGuestDetails() {
  const guests = [];
  const name = registeredGuestEl.value.trim();
  if (name) {
    guests.push({
      name,
      proofId: registeredGuestProofIdEl.value.trim(),
      relationship: registeredGuestRelationshipEl.value.trim(),
    });
  }
  companionsList.querySelectorAll('.companion-row').forEach((row) => {
    const companionName = row.querySelector('.companion-name').value.trim();
    if (!companionName) return;
    const proofIdEl = row.querySelector('.companion-proofid');
    const relationshipEl = row.querySelector('.companion-relationship');
    guests.push({
      name: companionName,
      proofId: proofIdEl ? proofIdEl.value.trim() : '',
      relationship: relationshipEl ? relationshipEl.value.trim() : '',
    });
  });
  return guests;
}

function updateBuildingUI() {
  buildingSubtitleEl.textContent = `${building.name} — ${building.form.title}`;
  registeredGuestExtraEl.style.display = isGuestAuthorizationForm() ? '' : 'none';
  attachmentsLabelEl.textContent = building.requiresHouseRulesPhoto
    ? 'Select all guest ID photos and the signed house rules photo together'
    : 'Select all guest ID photos together';
  updateAddCompanionBtnState();
}

// Switches the active building. { resetGuests: false } is used only when
// restoring a saved building on page load, so it doesn't wipe out a
// companion list that hasn't been created yet.
function setBuilding(key, { resetGuests = true } = {}) {
  buildingKey = key;
  building = BUILDINGS[key];
  buildingSelectEl.value = key;
  populateUnits();
  updateBuildingUI();
  if (resetGuests) {
    registeredGuestEl.value = '';
    registeredGuestProofIdEl.value = '';
    registeredGuestRelationshipEl.value = '';
    companionsList.innerHTML = '';
    addCompanionRow();
    invalidateGeneratedPermit();
  }
}

buildingSelectEl.addEventListener('change', () => {
  setBuilding(buildingSelectEl.value);
  persistDefaults();
});

import { fillGuestInfoSheet } from './filler.js';
import { fillGuestAuthorizationFormImage } from './image-filler.js';
import { renderPdfPageToPngBlob } from './render.js';
import { canShareFiles, buildMailtoUrl } from './share.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

const stayFromEl = document.getElementById('stayFrom');
const stayToEl = document.getElementById('stayTo');
const generateBtn = document.getElementById('generateBtn');
const genStatus = document.getElementById('genStatus');
const downloadLink = document.getElementById('pdfDownloadLink');
const sendBtn = document.getElementById('sendBtn');

let lastGeneratedFileBlob = null;
let lastFilledFilename = '';
let currentImageUrl = null;
let pdfjsLibPromise = null;

// pdf.js is only needed once the host actually generates a permit, and it's
// a large module (~400KB minified) — load it lazily on first use rather
// than blocking initial page load, and cache the import so repeated
// Generate clicks in one session don't re-fetch it.
function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('../vendor/pdfjs/pdf.min.mjs').then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
      return pdfjsLib;
    });
  }
  return pdfjsLibPromise;
}

function invalidateGeneratedPermit() {
  lastGeneratedFileBlob = null;
  lastFilledFilename = '';
  sendBtn.disabled = true;
  openMailBtn.disabled = true;
  downloadLink.style.display = 'none';
}

async function generate() {
  genStatus.textContent = '';
  genStatus.className = 'status';
  sendBtn.disabled = true;
  openMailBtn.disabled = true;

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

  genStatus.textContent = 'Generating…';

  const stayFromLong = formatDateLong(parseIsoDateLocal(stayFromEl.value));
  const stayToLong = formatDateLong(parseIsoDateLocal(stayToEl.value));
  const now = new Date();

  let outputBlob;
  if (isGuestAuthorizationForm()) {
    // Draws straight onto a pre-rendered blank snapshot of the template
    // instead of filling+rendering the real PDF — see the comment on
    // air.form in config.js for why.
    const templateImage = await loadImage(building.form.template);
    outputBlob = await fillGuestAuthorizationFormImage(templateImage, building.form, {
      tower: building.tower,
      unit: unitSelect.value,
      periodFrom: stayFromLong,
      // The template's "to" blank only has room for a day number (it reads
      // "period covering from [full date] to [day]."), so a same-month stay
      // is assumed — the form's own design, not something this app can fix.
      periodTo: String(parseIsoDateLocal(stayToEl.value).getDate()),
      guests: collectGuestDetails(),
      givenDay: String(now.getDate()),
      givenMonth: now.toLocaleDateString('en-US', { month: 'long' }),
      givenYear: String(now.getFullYear()).slice(-2),
      ownerName: ownerNameEl.value.trim(),
      signatureImage: sigPad,
    });
  } else {
    const templateResp = await fetch(building.form.template);
    const templateBytes = new Uint8Array(await templateResp.arrayBuffer());
    const filledPdfBytes = await fillGuestInfoSheet(window.PDFLib, templateBytes, building.form, {
      registeredGuest: registeredGuestEl.value.trim(),
      stayFrom: stayFromLong,
      stayTo: stayToLong,
      tower: building.tower,
      unit: unitSelect.value,
      ownerName: ownerNameEl.value.trim(),
      dateSigned: formatDateLong(now),
      companions: collectCompanionNames(),
      signaturePngBytes: sigBytes,
    });
    const pdfjsLib = await loadPdfjs();
    // scale:2 renders at roughly print resolution so the photo stays sharp
    // and legible, not blurry when the admin views/prints it.
    outputBlob = await renderPdfPageToPngBlob(pdfjsLib, filledPdfBytes, 2);
  }

  lastGeneratedFileBlob = outputBlob;
  lastFilledFilename = buildFilename({
    docTitle: building.form.title,
    unit: unitSelect.value,
    stayFromIso: stayFromEl.value,
    extension: 'png',
  });

  if (currentImageUrl) {
    URL.revokeObjectURL(currentImageUrl);
  }
  const url = URL.createObjectURL(outputBlob);
  currentImageUrl = url;
  downloadLink.href = url;
  downloadLink.download = lastFilledFilename;
  downloadLink.style.display = '';

  genStatus.textContent = `Generated "${lastFilledFilename}".`;
  persistDefaults();
  sendBtn.disabled = false;
  openMailBtn.disabled = false;
}

generateBtn.addEventListener('click', () => {
  generate().catch((err) => {
    genStatus.textContent = 'Something went wrong generating the permit: ' + err.message;
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
const openMailBtn = document.getElementById('openMailBtn');

// Web Share (and therefore file attachments) isn't available on most
// desktop browsers — don't offer a button that can only ever fail there.
if (!canShareFiles(navigator)) {
  sendBtn.style.display = 'none';
}

let lastEmailBody = '';

function downloadFile(bytesOrFile, filename) {
  const blob = bytesOrFile instanceof Blob ? bytesOrFile : new Blob([bytesOrFile], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Validates the form and builds the subject/body/attachments needed to
// send, shared by both the Share-sheet path and the direct-mailto path
// below. Returns null (after setting an error status) if anything's
// missing; otherwise returns everything the caller needs.
function prepareSend() {
  sendStatus.textContent = '';
  sendStatus.className = 'status';

  if (!lastGeneratedFileBlob) {
    sendStatus.textContent = 'Generate the permit first.';
    sendStatus.className = 'status err';
    return null;
  }

  if (!registeredGuestEl.value.trim() || !stayFromEl.value || !stayToEl.value) {
    sendStatus.textContent = 'Guest name and both stay dates are required.';
    sendStatus.className = 'status err';
    return null;
  }

  const guestNames = collectGuestNames();
  const attachments = Array.from(attachmentsInputEl.files);
  const shortfall = attachmentsShortfall(guestNames.length, attachments.length, building.requiresHouseRulesPhoto);
  if (shortfall > 0) {
    const need = building.requiresHouseRulesPhoto
      ? `one ID photo per guest (${guestNames.length}) plus the signed house rules`
      : `one ID photo per guest (${guestNames.length})`;
    sendStatus.textContent = `Select ${shortfall} more photo${shortfall === 1 ? '' : 's'} — you need ${need}.`;
    sendStatus.className = 'status err';
    return null;
  }

  const stayFromLong = formatDateLong(parseIsoDateLocal(stayFromEl.value));
  const stayToLong = formatDateLong(parseIsoDateLocal(stayToEl.value));

  const subject = buildEmailSubject({
    subjectTemplate: building.subjectTemplate,
    unit: unitSelect.value,
    stayFromLong,
    stayToLong,
  });
  const body = buildEmailBody({
    ownerName: ownerNameEl.value.trim(),
    ownerMobile: ownerMobileEl.value.trim(),
    unit: unitSelect.value,
    buildingName: building.displayName,
    docTitle: building.form.title,
    stayFromLong,
    stayToLong,
    guestNames,
    requiresHouseRulesPhoto: building.requiresHouseRulesPhoto,
  });

  adminEmailText.textContent = building.adminEmail;
  subjectText.textContent = subject;
  lastEmailBody = body;
  emailBox.style.display = '';

  return { subject, body, attachments };
}

async function send() {
  const prepared = prepareSend();
  if (!prepared) return;
  const { subject, body, attachments } = prepared;

  if (!canShareFiles(navigator)) {
    sendStatus.textContent = 'Web Share isn\'t available in this browser — use "Open Mail app" instead.';
    sendStatus.className = 'status err';
    return;
  }

  // Gmail's iOS app mishandles shared subject/body when files are attached
  // via the share sheet — confirmed both by direct testing here (subject
  // dropped in one test, paragraph breaks flattened into one line in
  // another) and by a multi-year, widely-reported bug in the react-native-
  // share library (github.com/react-native-community/react-native-share,
  // issue #414): experienced native-app developers with lower-level API
  // access than a website has never found a working fix either, so this is
  // treated as unfixable from here. Apple's own Mail app handles the exact
  // same payload correctly (confirmed by testing) — "Open Mail app" above
  // uses a mailto: link instead, a completely different integration point
  // that bypasses Gmail's share extension entirely, at the cost of not
  // auto-attaching files.
  const shareImageFile = new File([lastGeneratedFileBlob], `${subject}.png`, { type: 'image/png' });
  try {
    await navigator.share({ files: [shareImageFile, ...attachments], title: subject, text: body });
    let clipboardNote = '';
    try {
      await navigator.clipboard.writeText(subject);
      clipboardNote = " The subject is copied to your clipboard in case it's blank — paste it into the Subject field.";
    } catch {
      // Clipboard write can fail (permissions, focus) — Copy subject below still covers this.
    }
    sendStatus.textContent = `Shared.${clipboardNote} If you picked Gmail and the subject or paragraph spacing came out wrong, that's a known Gmail limitation — tap "Copy body" below and paste it in, or use "Open Mail app" instead for a cleanly formatted draft (you'll attach the downloaded photos yourself).`;
  } catch (err) {
    if (err.name !== 'AbortError') {
      sendStatus.textContent = 'Share failed: ' + err.message;
      sendStatus.className = 'status err';
    }
  }
}

// Uses mailto: instead of the Share Sheet — a different integration point
// in every mail app (including Gmail), which reliably fills the subject
// and body since it's just parsing a standard URL, not depending on an
// app's own share-extension code. The trade-off: mailto: can't attach
// files (a hard platform limit, not fixable from a website), so this
// downloads everything first for the host to attach by hand.
function openMailDirectly() {
  const prepared = prepareSend();
  if (!prepared) return;
  const { subject, body, attachments } = prepared;

  downloadFile(lastGeneratedFileBlob, lastFilledFilename);
  attachments.forEach((file) => downloadFile(file, file.name));
  window.location.href = buildMailtoUrl({ to: building.adminEmail, subject, body });
  const attachmentsDesc = building.requiresHouseRulesPhoto ? 'ID photos, and house rules photo' : 'ID photos';
  sendStatus.textContent = `Downloaded the filled permit and ${attachmentsDesc}, and opened a Mail draft with the subject and body correctly filled in — attach the downloaded files.`;
}

sendBtn.addEventListener('click', () => {
  send().catch((err) => {
    sendStatus.textContent = 'Something went wrong: ' + err.message;
    sendStatus.className = 'status err';
  });
});

openMailBtn.addEventListener('click', () => {
  try {
    openMailDirectly();
  } catch (err) {
    sendStatus.textContent = 'Something went wrong: ' + err.message;
    sendStatus.className = 'status err';
  }
});

copyAdminEmailBtn.addEventListener('click', () => navigator.clipboard.writeText(building.adminEmail));
copySubjectBtn.addEventListener('click', () => navigator.clipboard.writeText(subjectText.textContent));
copyBodyBtn.addEventListener('click', () => navigator.clipboard.writeText(lastEmailBody));

populateBuildingSelect();
populateUnits();
updateBuildingUI();
// Defer the initial measurement two frames so it runs after the browser's
// first layout pass has settled — measuring immediately can catch the
// canvas mid-layout (e.g. during a container/viewport still resizing) and
// permanently lock in a too-small drawing buffer, since there's no other
// trigger to re-measure until a later window resize.
requestAnimationFrame(() => requestAnimationFrame(() => {
  resizeCanvas();
  if (pendingSignatureDataUrl) restoreSavedSignature(pendingSignatureDataUrl);
}));
attachSignaturePad();
loadSavedDefaults();
ownerNameEl.addEventListener('change', persistDefaults);
ownerMobileEl.addEventListener('change', persistDefaults);
unitSelect.addEventListener('change', persistDefaults);
registeredGuestEl.addEventListener('input', invalidateGeneratedPermit);
stayFromEl.addEventListener('input', invalidateGeneratedPermit);
stayToEl.addEventListener('input', invalidateGeneratedPermit);
unitSelect.addEventListener('input', invalidateGeneratedPermit);
ownerNameEl.addEventListener('input', invalidateGeneratedPermit);
registeredGuestProofIdEl.addEventListener('input', invalidateGeneratedPermit);
registeredGuestRelationshipEl.addEventListener('input', invalidateGeneratedPermit);
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
      invalidateGeneratedPermit();
    }
  }, 200);
});
