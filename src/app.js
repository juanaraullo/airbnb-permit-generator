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
      invalidateGeneratedPermit();
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

import { attachmentsShortfall, formatDateLong, parseIsoDateLocal, buildFilename, buildEmailSubject, buildEmailBody } from './fields.js';

const companionsList = document.getElementById('companionsList');
const addCompanionBtn = document.getElementById('addCompanionBtn');
const registeredGuestEl = document.getElementById('registeredGuest');
const attachmentsInputEl = document.getElementById('attachmentsInput');
const attachmentsSummaryEl = document.getElementById('attachmentsSummary');

function updateAttachmentsSummary() {
  const count = attachmentsInputEl.files.length;
  attachmentsSummaryEl.textContent = count
    ? `${count} photo${count === 1 ? '' : 's'} selected.`
    : '';
}
attachmentsInputEl.addEventListener('change', updateAttachmentsSummary);

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
  if (evt.target.classList.contains('companion-name')) invalidateGeneratedPermit();
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

import { fillGuestInfoSheet } from './filler.js';
import { renderPdfPageToPngBlob } from './render.js';
import { canShareFiles, buildMailtoUrl } from './share.js';

const stayFromEl = document.getElementById('stayFrom');
const stayToEl = document.getElementById('stayTo');
const generateBtn = document.getElementById('generateBtn');
const genStatus = document.getElementById('genStatus');
const downloadLink = document.getElementById('pdfDownloadLink');
const sendBtn = document.getElementById('sendBtn');

let lastGeneratedImageBlob = null;
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
  lastGeneratedImageBlob = null;
  lastFilledFilename = '';
  sendBtn.disabled = true;
  downloadLink.style.display = 'none';
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

  genStatus.textContent = 'Generating…';

  const templateResp = await fetch(building.form.template);
  const templateBytes = new Uint8Array(await templateResp.arrayBuffer());

  const stayFromLong = formatDateLong(parseIsoDateLocal(stayFromEl.value));
  const stayToLong = formatDateLong(parseIsoDateLocal(stayToEl.value));

  const filledPdfBytes = await fillGuestInfoSheet(window.PDFLib, templateBytes, building.form, {
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

  const pdfjsLib = await loadPdfjs();
  // scale:2 renders at roughly print resolution (the template is a US
  // Legal page, 612x1008pt -> ~1224x2016px at scale 2) so the photo stays
  // sharp and legible, not blurry when the admin views/prints it.
  const imageBlob = await renderPdfPageToPngBlob(pdfjsLib, filledPdfBytes, 2);

  lastGeneratedImageBlob = imageBlob;
  lastFilledFilename = buildFilename({ unit: unitSelect.value, stayFromIso: stayFromEl.value });

  if (currentImageUrl) {
    URL.revokeObjectURL(currentImageUrl);
  }
  const url = URL.createObjectURL(imageBlob);
  currentImageUrl = url;
  downloadLink.href = url;
  downloadLink.download = lastFilledFilename;
  downloadLink.style.display = '';

  genStatus.textContent = `Generated "${lastFilledFilename}".`;
  persistDefaults();
  sendBtn.disabled = false;
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

let lastEmailBody = '';

function downloadFile(bytesOrFile, filename) {
  const blob = bytesOrFile instanceof Blob ? bytesOrFile : new Blob([bytesOrFile], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function send() {
  sendStatus.textContent = '';
  sendStatus.className = 'status';

  if (!lastGeneratedImageBlob) {
    sendStatus.textContent = 'Generate the permit first.';
    sendStatus.className = 'status err';
    return;
  }

  if (!registeredGuestEl.value.trim() || !stayFromEl.value || !stayToEl.value) {
    sendStatus.textContent = 'Guest name and both stay dates are required.';
    sendStatus.className = 'status err';
    return;
  }

  const guestNames = collectGuestNames();
  const attachments = Array.from(attachmentsInputEl.files);
  const shortfall = attachmentsShortfall(guestNames.length, attachments.length);
  if (shortfall > 0) {
    sendStatus.textContent = `Select ${shortfall} more photo${shortfall === 1 ? '' : 's'} — you need one ID photo per guest (${guestNames.length}) plus the signed house rules.`;
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
    guestNames,
  });

  adminEmailText.textContent = building.adminEmail;
  subjectText.textContent = subject;
  lastEmailBody = body;
  emailBox.style.display = '';

  if (canShareFiles(navigator)) {
    // Some mail apps' iOS share extensions (observed with Gmail) ignore the
    // Web Share API's `title` entirely and instead auto-fill the email
    // subject from the shared *document* file's own filename — but only
    // for document-type attachments (PDF, etc). A shared *image* doesn't
    // get that treatment (photo filenames are usually meaningless, like
    // IMG_1234, so mail apps reasonably don't use them as a subject), so
    // naming the PNG after the subject — unlike when this app generated a
    // PDF — doesn't reliably produce a subject anymore. Kept anyway since
    // it's harmless and may still help on some platforms, but the clipboard
    // copy below is the actual reliable fix.
    const shareImageFile = new File([lastGeneratedImageBlob], `${subject}.png`, { type: 'image/png' });
    try {
      await navigator.share({ files: [shareImageFile, ...attachments], title: subject, text: body });
      // Since the subject can no longer be relied on to carry over at all,
      // put it straight on the clipboard so it's one paste away — the
      // Subject field is usually the first thing in a mail compose screen,
      // so this covers the most common case in one action. The body (which
      // still has its own line-break-collapsing issue in some apps) stays
      // available via the separate Copy body button rather than fighting
      // over the single clipboard slot.
      let clipboardNote = '';
      try {
        await navigator.clipboard.writeText(subject);
        clipboardNote = " The subject is copied to your clipboard — paste it into the Subject field, since the app you picked may have left it blank or wrong.";
      } catch {
        // Clipboard write can fail (permissions, focus) — the on-screen
        // Copy subject button still covers this, so just skip the note.
      }
      sendStatus.textContent = `Shared.${clipboardNote} If the body looks squished together, tap Copy body below and paste over it too.`;
    } catch (err) {
      if (err.name !== 'AbortError') {
        sendStatus.textContent = 'Share failed: ' + err.message;
        sendStatus.className = 'status err';
      }
    }
  } else {
    downloadFile(lastGeneratedImageBlob, lastFilledFilename);
    attachments.forEach((file) => downloadFile(file, file.name));
    window.location.href = buildMailtoUrl({ to: building.adminEmail, subject, body });
    sendStatus.textContent = 'Downloaded the permit image, ID photos, and house rules photo, and opened a Mail draft — attach the downloaded files.';
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
registeredGuestEl.addEventListener('input', invalidateGeneratedPermit);
stayFromEl.addEventListener('input', invalidateGeneratedPermit);
stayToEl.addEventListener('input', invalidateGeneratedPermit);
unitSelect.addEventListener('input', invalidateGeneratedPermit);
ownerNameEl.addEventListener('input', invalidateGeneratedPermit);
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
