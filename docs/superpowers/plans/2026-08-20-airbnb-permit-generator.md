# Airbnb Permit Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, client-side web app (hosted on GitHub Pages) that fills the Uptown Parksuites Guest Information Sheet PDF with guest name(s), stay dates, tower/unit, and the host's signature, then hands the filled PDF plus guest ID photos to the phone's native Share Sheet (or a `mailto:` fallback on desktop) so the host can email it to the building admin in as few taps as possible.

**Architecture:** Pure client-side app, no backend. `pdf-lib` fills the PDF in the browser using coordinates already calibrated against the real template (see Task 2). Pure logic (filename/email text building, `localStorage` defaults, share-capability detection, PDF filling) lives in small testable ES modules under `src/`, unit-tested with Node's built-in test runner. `app.js` is the thin DOM-wiring layer, verified manually in a real browser since it has no meaningful logic of its own to unit test.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules, no bundler), [pdf-lib](https://pdf-lib.js.org/) (vendored UMD build for the browser, npm package for tests), Node's built-in `node:test` + `node:assert/strict`, `pdfjs-dist` (dev-only, used to calibrate and to round-trip-verify filled PDFs in tests), GitHub Pages for hosting.

---

## Reference data gathered during design (do not re-derive)

**Template:** `/Users/johnaraullo/Desktop/CLAUDE/airbnb forms/GUEST INFO SHEET.pdf` — page size 612×1008 pt. Confirmed byte-identical (sha256 `aa0a587d...`) to the template used in the prior `airbnb-forms-generator` project, but the coordinates below were independently re-derived from the PDF's own text layer (via `pdfjs-dist`) and verified by rendering a real test fill — not copied from the old project.

**Calibrated field coordinates** (PDF points, origin bottom-left), verified by rendering a filled test PDF and visually confirming every value sits on its line:

| Field | x | y | size | notes |
|---|---|---|---|---|
| registeredGuest | 197 | 855 | 10 | |
| stayFrom | 231 | 738 | 9 | |
| stayTo | 313 | 738 | 9 | |
| tower | 124 | 305 | 9 | |
| unit | 229 | 305 | 9 | |
| ownerNameDate | 210 | 244 | 9 | text: `"{ownerName} / {dateSigned}"` |
| signature (image box) | x=195, y=246, w=225, h=32 | | | image centered/scaled to fit box |
| companionRows | x=90, startY=563, rowH=19, max=5, size=9 | | | row *i* baseline = `startY - i*rowH` |

**Building data:** Uptown Parksuites, tower `"Tower 2"`, units `["24J", "8T"]`, admin email `clientcare.uptownparksuites@asia-affinity.com` (same values as the prior project's config for this same building — these are operational facts about the building, not code being reused).

---

## File Structure

```
airbnb-permit-generator/
  index.html              # form UI shell
  manifest.json            # PWA installability (add-to-homescreen)
  icon-192.png, icon-512.png, apple-touch-icon.png   # generated, not hand-drawn
  vendor/pdf-lib.min.js    # UMD build, used by index.html via <script>
  templates/uptown-guest-info.pdf
  src/
    config.js              # BUILDINGS data + calibrated field coordinates
    fields.js               # pure: filename/subject/body builders, date formatting, ID validation
    signature-store.js      # pure: localStorage get/set for saved host defaults
    share.js                 # pure: Web Share capability detection, mailto URL builder
    filler.js                 # pdf-lib fill logic (Node + browser, PDFLib namespace injected)
    app.js                     # DOM wiring only — imports the above, no logic of its own
  scripts/
    make-icons.mjs           # dependency-free PNG icon generator
  tests/
    fields.test.js
    signature-store.test.js
    share.test.js
    filler.test.js
  package.json
  .gitignore
```

Each `src/` file has one job: `config.js` is data, `fields.js` is text formatting, `signature-store.js` is persistence, `share.js` is capability detection + URL building, `filler.js` is PDF manipulation, `app.js` is glue. This keeps every piece of real logic unit-testable without a browser, and keeps `app.js` small enough to verify by hand.

---

### Task 1: Project scaffold

**Files:**
- Create: `airbnb-permit-generator/package.json`
- Create: `airbnb-permit-generator/.gitignore`
- Create: `airbnb-permit-generator/vendor/pdf-lib.min.js` (copy)
- Create: `airbnb-permit-generator/templates/uptown-guest-info.pdf` (copy)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "airbnb-permit-generator",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  },
  "devDependencies": {
    "pdf-lib": "^1.17.1",
    "pdfjs-dist": "^4.0.379"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
*.log
```

- [ ] **Step 3: Install dependencies**

Run: `cd airbnb-permit-generator && npm install`
Expected: `node_modules/pdf-lib` and `node_modules/pdfjs-dist` exist, no errors.

- [ ] **Step 4: Copy the vendored pdf-lib browser build and the real template PDF**

Run:
```bash
cp "/Users/johnaraullo/Desktop/CLAUDE/airbnb-forms-generator/pdf-lib.min.js" \
   "/Users/johnaraullo/Desktop/CLAUDE/airbnb-permit-generator/vendor/pdf-lib.min.js"
mkdir -p "/Users/johnaraullo/Desktop/CLAUDE/airbnb-permit-generator/templates"
cp "/Users/johnaraullo/Desktop/CLAUDE/airbnb forms/GUEST INFO SHEET.pdf" \
   "/Users/johnaraullo/Desktop/CLAUDE/airbnb-permit-generator/templates/uptown-guest-info.pdf"
```
Expected: both files exist at their destinations (`ls` each to confirm).

- [ ] **Step 5: Commit**

```bash
cd /Users/johnaraullo/Desktop/CLAUDE/airbnb-permit-generator
git add package.json package-lock.json .gitignore vendor/pdf-lib.min.js templates/uptown-guest-info.pdf
git commit -m "chore: project scaffold, vendored pdf-lib, real template"
```

---

### Task 2: `config.js` — building and field data

**Files:**
- Create: `airbnb-permit-generator/src/config.js`
- Test: `airbnb-permit-generator/tests/config.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/config.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS } from '../src/config.js';

test('uptown building has the expected shape', () => {
  const uptown = BUILDINGS.uptown;
  assert.equal(uptown.name, 'Uptown Parksuites');
  assert.equal(uptown.tower, 'Tower 2');
  assert.deepEqual(uptown.units, ['24J', '8T']);
  assert.equal(uptown.adminEmail, 'clientcare.uptownparksuites@asia-affinity.com');
  assert.equal(uptown.form.template, 'templates/uptown-guest-info.pdf');
});

test('uptown field coordinates match the calibrated values', () => {
  const f = BUILDINGS.uptown.form.fields;
  assert.deepEqual(f.registeredGuest, { x: 197, y: 855, size: 10 });
  assert.deepEqual(f.companionRows, { x: 90, startY: 563, rowH: 19, max: 5, size: 9 });
  assert.deepEqual(f.signature, { x: 195, y: 246, w: 225, h: 32 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/config.js'`

- [ ] **Step 3: Write `src/config.js`**

```js
export const BUILDINGS = {
  uptown: {
    name: 'Uptown Parksuites',
    tower: 'Tower 2',
    units: ['24J', '8T'],
    adminEmail: 'clientcare.uptownparksuites@asia-affinity.com',
    form: {
      title: 'Guest Information Sheet',
      template: 'templates/uptown-guest-info.pdf',
      pageSize: { width: 612, height: 1008 },
      fields: {
        registeredGuest: { x: 197, y: 855, size: 10 },
        stayFrom: { x: 231, y: 738, size: 9 },
        stayTo: { x: 313, y: 738, size: 9 },
        tower: { x: 124, y: 305, size: 9 },
        unit: { x: 229, y: 305, size: 9 },
        ownerNameDate: { x: 210, y: 244, size: 9 },
        signature: { x: 195, y: 246, w: 225, h: 32 },
        companionRows: { x: 90, startY: 563, rowH: 19, max: 5, size: 9 },
      },
    },
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/config.js tests/config.test.js
git commit -m "feat: building and calibrated field config"
```

---

### Task 3: `fields.js` — pure text/date/validation helpers

**Files:**
- Create: `airbnb-permit-generator/src/fields.js`
- Test: `airbnb-permit-generator/tests/fields.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/fields.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateLong,
  parseIsoDateLocal,
  buildFilename,
  buildEmailSubject,
  buildEmailBody,
  missingGuestIds,
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

test('buildFilename includes unit and stay date, no illegal characters', () => {
  const name = buildFilename({ unit: '24J', stayFromIso: '2026-08-20' });
  assert.equal(name, 'Guest Info Sheet - Unit 24J - 2026-08-20.pdf');
});

test('buildEmailSubject includes unit and guest name', () => {
  const subject = buildEmailSubject({ unit: '24J', registeredGuest: 'Juan Dela Cruz' });
  assert.equal(subject, 'Guest Information Sheet — Unit 24J — Juan Dela Cruz');
});

test('buildEmailBody includes stay dates and host contact', () => {
  const body = buildEmailBody({
    ownerName: 'Juan Araullo',
    ownerMobile: '0917 000 0000',
    unit: '24J',
    buildingName: 'Uptown Parksuites',
    stayFromLong: 'Aug 20, 2026',
    stayToLong: 'Aug 25, 2026',
  });
  assert.match(body, /Unit 24J, Uptown Parksuites/);
  assert.match(body, /Aug 20, 2026 to Aug 25, 2026/);
  assert.match(body, /Juan Araullo/);
  assert.match(body, /0917 000 0000/);
});

test('missingGuestIds returns names of guests without a photo', () => {
  const missing = missingGuestIds([
    { name: 'Juan Dela Cruz', hasId: true },
    { name: 'Maria Santos', hasId: false },
    { name: '', hasId: false },
  ]);
  assert.deepEqual(missing, ['Maria Santos', '(unnamed guest)']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/fields.js'`

- [ ] **Step 3: Write `src/fields.js`**

```js
export function formatDateLong(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function parseIsoDateLocal(isoDateStr) {
  const [y, m, d] = isoDateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function buildFilename({ unit, stayFromIso }) {
  return `Guest Info Sheet - Unit ${unit} - ${stayFromIso}.pdf`;
}

export function buildEmailSubject({ unit, registeredGuest }) {
  return `Guest Information Sheet — Unit ${unit} — ${registeredGuest}`;
}

export function buildEmailBody({ ownerName, ownerMobile, unit, buildingName, stayFromLong, stayToLong }) {
  return `Hi,\n\nPlease find attached the Guest Information Sheet for Unit ${unit}, ${buildingName}, along with the guest's valid ID.\n\nStay: ${stayFromLong} to ${stayToLong}\n\nThank you,\n${ownerName}\n${ownerMobile}`;
}

export function missingGuestIds(guests) {
  return guests.filter((g) => !g.hasId).map((g) => (g.name ? g.name : '(unnamed guest)'));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/fields.js tests/fields.test.js
git commit -m "feat: pure text/date/validation helpers"
```

---

### Task 4: `signature-store.js` — saved host defaults

**Files:**
- Create: `airbnb-permit-generator/src/signature-store.js`
- Test: `airbnb-permit-generator/tests/signature-store.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/signature-store.test.js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/signature-store.js'`

- [ ] **Step 3: Write `src/signature-store.js`**

```js
const STORAGE_KEY = 'airbnb-permit-generator:defaults';
const EMPTY_DEFAULTS = { ownerName: '', ownerMobile: '', unit: '', signaturePngDataUrl: '' };

export function loadDefaults(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { ...EMPTY_DEFAULTS };
  try {
    return { ...EMPTY_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_DEFAULTS };
  }
}

export function saveDefaults(defaults, storage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(defaults));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/signature-store.js tests/signature-store.test.js
git commit -m "feat: localStorage-backed host defaults"
```

---

### Task 5: `share.js` — Web Share capability + mailto fallback

**Files:**
- Create: `airbnb-permit-generator/src/share.js`
- Test: `airbnb-permit-generator/tests/share.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/share.test.js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/share.js'`

- [ ] **Step 3: Write `src/share.js`**

```js
export function canShareFiles(nav) {
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    const probe = new File(['x'], 'probe.pdf', { type: 'application/pdf' });
    return nav.canShare({ files: [probe] }) === true;
  } catch {
    return false;
  }
}

export function buildMailtoUrl({ to, subject, body }) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (5 tests) — Node 20+ provides global `File`; if the test run fails with `File is not defined`, add `import { File } from 'node:buffer';` and assign it to `globalThis.File` at the top of `tests/share.test.js` before the assertions run.

- [ ] **Step 5: Commit**

```bash
git add src/share.js tests/share.test.js
git commit -m "feat: web share capability detection and mailto builder"
```

---

### Task 6: `filler.js` — fill the PDF with pdf-lib

**Files:**
- Create: `airbnb-permit-generator/src/filler.js`
- Test: `airbnb-permit-generator/tests/filler.test.js`

- [ ] **Step 1: Write the failing test (fills a PDF, then reads it back with pdfjs-dist to confirm text landed where expected)**

```js
// tests/filler.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as PDFLib from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fillGuestInfoSheet } from '../src/filler.js';
import { BUILDINGS } from '../src/config.js';

test('fillGuestInfoSheet places guest name, dates, unit, and companions at the calibrated positions', async () => {
  const templateBytes = readFileSync(new URL('../templates/uptown-guest-info.pdf', import.meta.url));
  const outBytes = await fillGuestInfoSheet(PDFLib, templateBytes, BUILDINGS.uptown.form, {
    registeredGuest: 'Juan Dela Cruz',
    stayFrom: 'Aug 20, 2026',
    stayTo: 'Aug 25, 2026',
    tower: 'Tower 2',
    unit: '24J',
    ownerName: 'Juan Araullo',
    dateSigned: 'Aug 20, 2026',
    companions: ['Maria Santos', 'Pedro Reyes'],
  });

  const doc = await pdfjsLib.getDocument({ data: outBytes }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const items = content.items.map((it) => ({ text: it.str, x: it.transform[4], y: it.transform[5] }));

  const guestItem = items.find((it) => it.text.includes('Juan Dela Cruz'));
  assert.ok(guestItem, 'registered guest name not found in filled PDF');
  assert.ok(Math.abs(guestItem.y - 855) < 2, `expected guest name near y=855, got y=${guestItem.y}`);

  assert.ok(items.some((it) => it.text.includes('Maria Santos')), 'companion 1 not found');
  assert.ok(items.some((it) => it.text.includes('Pedro Reyes')), 'companion 2 not found');
  assert.ok(items.some((it) => it.text.includes('24J')), 'unit not found');
  assert.ok(items.some((it) => it.text.includes('Aug 25, 2026')), 'stay-to date not found');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/filler.js'`

- [ ] **Step 3: Write `src/filler.js`**

```js
export async function fillGuestInfoSheet(PDFLib, templateBytes, formConfig, data) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPages()[0];
  const ink = rgb(0.05, 0.05, 0.15);

  function draw(text, x, y, size) {
    if (!text) return;
    page.drawText(String(text), { x, y, size, font, color: ink });
  }

  const f = formConfig.fields;
  draw(data.registeredGuest, f.registeredGuest.x, f.registeredGuest.y, f.registeredGuest.size);
  draw(data.stayFrom, f.stayFrom.x, f.stayFrom.y, f.stayFrom.size);
  draw(data.stayTo, f.stayTo.x, f.stayTo.y, f.stayTo.size);
  draw(data.tower, f.tower.x, f.tower.y, f.tower.size);
  draw(data.unit, f.unit.x, f.unit.y, f.unit.size);
  draw(`${data.ownerName} / ${data.dateSigned}`, f.ownerNameDate.x, f.ownerNameDate.y, f.ownerNameDate.size);

  const rows = f.companionRows;
  (data.companions || []).slice(0, rows.max).forEach((name, i) => {
    draw(name, rows.x, rows.startY - i * rows.rowH, rows.size);
  });

  if (data.signaturePngBytes) {
    const sigImage = await pdfDoc.embedPng(data.signaturePngBytes);
    const box = f.signature;
    const scale = Math.min(box.w / sigImage.width, box.h / sigImage.height);
    const w = sigImage.width * scale;
    const h = sigImage.height * scale;
    page.drawImage(sigImage, {
      x: box.x + (box.w - w) / 2,
      y: box.y + (box.h - h) / 2,
      width: w,
      height: h,
    });
  }

  return pdfDoc.save();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (1 test in this file; all prior tests still pass too)

- [ ] **Step 5: Commit**

```bash
git add src/filler.js tests/filler.test.js
git commit -m "feat: fill Guest Information Sheet PDF with pdf-lib"
```

---

### Task 7: `index.html` — form shell

**Files:**
- Create: `airbnb-permit-generator/index.html`

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<title>Airbnb Permit Generator</title>
<style>
  :root{
    --bg:#f6f7fb; --card:#ffffff; --border:#e3e6ee; --text:#1c2130; --muted:#6b7280;
    --accent:#3454d1; --accent-dark:#2540a8; --accent-bg:#eef1ff;
    --danger:#d64545; --ok:#1f9d55; --radius:14px;
  }
  *{box-sizing:border-box;}
  body{margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:var(--bg); color:var(--text); line-height:1.45;}
  .wrap{max-width:640px; margin:0 auto; padding:24px 18px 80px;}
  h1{font-size:19px; margin:0 0 2px;}
  .sub{color:var(--muted); font-size:13px; margin:0 0 20px;}
  .card{background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:18px 20px; margin-bottom:16px;}
  .card h2{font-size:14.5px; margin:0 0 12px;}
  .field{margin-bottom:12px;}
  .field label{display:block; font-size:12.5px; font-weight:600; color:#3a3f52; margin-bottom:5px;}
  .row{display:flex; gap:12px;}
  .row .field{flex:1;}
  input[type=text], input[type=date], input[type=tel], select{width:100%; padding:9px 11px; border:1px solid var(--border); border-radius:8px; font-size:14px; background:#fff; color:var(--text); font-family:inherit;}
  input:focus, select:focus{outline:2px solid var(--accent); outline-offset:0; border-color:var(--accent);}
  .companion-row{display:flex; gap:8px; align-items:center; margin-bottom:8px;}
  .companion-row input[type=text]{flex:2;}
  .companion-row input[type=file]{flex:2; font-size:12px;}
  .companion-row button{flex:0 0 auto;}
  button{font-family:inherit; cursor:pointer;}
  .btn{padding:9px 16px; border-radius:9px; border:1px solid var(--border); background:#fff; font-size:13.5px; font-weight:600; color:var(--text);}
  .btn.primary{background:var(--accent); border-color:var(--accent); color:#fff;}
  .btn.small{padding:6px 10px; font-size:12.5px;}
  .btn:disabled{opacity:.45; cursor:not-allowed;}
  canvas#sigPad{width:100%; height:130px; background:#fff; border:1px solid var(--border); border-radius:8px; touch-action:none; cursor:crosshair;}
  .sig-actions{margin-top:8px;}
  .status{font-size:13px; padding:8px 0; color:var(--ok);}
  .status.err{color:var(--danger);}
  .email-box{background:var(--accent-bg); border-radius:10px; padding:12px 14px; margin-top:12px; font-size:13px;}
  .email-box .to{display:flex; align-items:center; gap:8px; margin-bottom:6px;}
  a.download-link{display:inline-block; margin-top:8px; font-size:13px;}
</style>
</head>
<body>
<div class="wrap">
  <h1>Airbnb Permit Generator</h1>
  <p class="sub">Uptown Parksuites — Guest Information Sheet</p>

  <div class="card">
    <h2>Booking</h2>
    <div class="row">
      <div class="field">
        <label for="unitSelect">Unit</label>
        <select id="unitSelect"></select>
      </div>
      <div class="field">
        <label for="stayFrom">Stay from</label>
        <input type="date" id="stayFrom">
      </div>
      <div class="field">
        <label for="stayTo">Stay to</label>
        <input type="date" id="stayTo">
      </div>
    </div>
    <div class="field">
      <label for="registeredGuest">Registered guest name</label>
      <input type="text" id="registeredGuest" placeholder="Full name">
    </div>
    <div class="field">
      <label for="registeredGuestId">Registered guest's ID photo</label>
      <input type="file" id="registeredGuestId" accept="image/*" capture="environment">
    </div>
  </div>

  <div class="card">
    <h2>Other companions <span style="font-weight:400;color:var(--muted)">(optional)</span></h2>
    <div id="companionsList"></div>
    <button class="btn small" id="addCompanionBtn" type="button">+ Add companion</button>
  </div>

  <div class="card">
    <h2>Host</h2>
    <div class="row">
      <div class="field">
        <label for="ownerName">Your name</label>
        <input type="text" id="ownerName">
      </div>
      <div class="field">
        <label for="ownerMobile">Your mobile</label>
        <input type="tel" id="ownerMobile">
      </div>
    </div>
    <div class="field">
      <label>Signature</label>
      <canvas id="sigPad" width="600" height="130"></canvas>
      <div class="sig-actions">
        <button class="btn small" id="clearSigBtn" type="button">Clear</button>
      </div>
    </div>
  </div>

  <div class="card">
    <button class="btn primary" id="generateBtn" type="button">Generate permit</button>
    <div id="genStatus" class="status"></div>
    <a id="pdfDownloadLink" class="download-link" style="display:none" download>Download filled PDF</a>
  </div>

  <div class="card">
    <button class="btn primary" id="sendBtn" type="button" disabled>Send</button>
    <div id="sendStatus" class="status"></div>
    <div id="emailBox" class="email-box" style="display:none">
      <div class="to">To: <span id="adminEmailText"></span> <button class="btn small" id="copyAdminEmailBtn" type="button">Copy</button></div>
      <div>Subject: <span id="subjectText"></span> <button class="btn small" id="copySubjectBtn" type="button">Copy</button></div>
    </div>
  </div>
</div>

<script src="vendor/pdf-lib.min.js"></script>
<script type="module" src="src/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: form UI shell"
```

---

### Task 8: `app.js` part 1 — init, unit select, saved defaults, signature pad

**Files:**
- Create: `airbnb-permit-generator/src/app.js`

- [ ] **Step 1: Write the initial `src/app.js`**

```js
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

populateUnits();
resizeCanvas();
attachSignaturePad();
loadSavedDefaults();
ownerNameEl.addEventListener('change', persistDefaults);
ownerMobileEl.addEventListener('change', persistDefaults);
unitSelect.addEventListener('change', persistDefaults);
```

- [ ] **Step 2: Commit**

```bash
git add src/app.js
git commit -m "feat(app): init, unit select, saved defaults, signature pad"
```

---

### Task 9: `app.js` part 2 — companion rows and ID photo validation

**Files:**
- Modify: `airbnb-permit-generator/src/app.js` (append before the final lines that call `populateUnits()` etc. — move that init block to the very end of the file after this task's additions)

- [ ] **Step 1: Add companion row management, inserted above the `populateUnits(); resizeCanvas(); ...` init block**

```js
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
```

- [ ] **Step 2: Move the existing init calls to the bottom of the file, after all function definitions from this and the next tasks**

Cut the four lines `populateUnits(); resizeCanvas(); attachSignaturePad(); loadSavedDefaults();` and the two `addEventListener` lines from Task 8's end — they'll be restored as the single init block at the very end of the file in Task 12, Step 3. For now just leave them where they are; Task 12 consolidates the file's ending.

- [ ] **Step 3: Commit**

```bash
git add src/app.js
git commit -m "feat(app): companion rows and guest ID collection"
```

---

### Task 10: `app.js` part 3 — Generate button

**Files:**
- Modify: `airbnb-permit-generator/src/app.js` (append new imports at top, new function + wiring above the init block)

- [ ] **Step 1: Add the Generate handler**

```js
import { fillGuestInfoSheet } from './filler.js';
import { formatDateLong, parseIsoDateLocal, buildFilename } from './fields.js';

const stayFromEl = document.getElementById('stayFrom');
const stayToEl = document.getElementById('stayTo');
const generateBtn = document.getElementById('generateBtn');
const genStatus = document.getElementById('genStatus');
const pdfDownloadLink = document.getElementById('pdfDownloadLink');
const sendBtn = document.getElementById('sendBtn');

let lastFilledPdfBytes = null;
let lastFilledFilename = '';

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

  const blob = new Blob([outBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app.js
git commit -m "feat(app): generate filled PDF and offer download"
```

---

### Task 11: `app.js` part 4 — Send (Share Sheet or mailto fallback)

**Files:**
- Modify: `airbnb-permit-generator/src/app.js` (append new imports at top, new function + wiring above the init block)

- [ ] **Step 1: Add the Send handler**

```js
import { canShareFiles, buildMailtoUrl } from './share.js';
import { buildEmailSubject, buildEmailBody } from './fields.js';

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
```

- [ ] **Step 2: Commit**

```bash
git add src/app.js
git commit -m "feat(app): send via Web Share with mailto fallback"
```

---

### Task 12: `app.js` cleanup — single init block at the end

**Files:**
- Modify: `airbnb-permit-generator/src/app.js`

- [ ] **Step 1: Remove the two separate init snippets left by Tasks 8 and 9, and add one consolidated block as the very last lines of the file**

Delete the `populateUnits(); resizeCanvas(); attachSignaturePad(); loadSavedDefaults();` block and its two trailing `addEventListener` lines from wherever Task 8 left them. Add this as the final lines of `src/app.js`:

```js
populateUnits();
resizeCanvas();
attachSignaturePad();
loadSavedDefaults();
ownerNameEl.addEventListener('change', persistDefaults);
ownerMobileEl.addEventListener('change', persistDefaults);
unitSelect.addEventListener('change', persistDefaults);
addCompanionRow();
```

(`addCompanionRow()` at the end seeds one empty companion row so the "+ Add companion" affordance is discoverable — the row is optional and ignored if left blank per `collectGuests()`.)

- [ ] **Step 2: Read through the full file once and confirm every function referenced (`populateUnits`, `resizeCanvas`, `attachSignaturePad`, `loadSavedDefaults`, `persistDefaults`, `signaturePngBytes`, `addCompanionRow`, `collectGuests`, `collectCompanionNames`, `collectAllIdFiles`, `generate`, `send`) is defined exactly once and used with a consistent name.**

- [ ] **Step 3: Commit**

```bash
git add src/app.js
git commit -m "refactor(app): consolidate init block"
```

---

### Task 13: PWA installability — manifest, icons

**Files:**
- Create: `airbnb-permit-generator/scripts/make-icons.mjs`
- Create (generated): `airbnb-permit-generator/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
- Create: `airbnb-permit-generator/manifest.json`

- [ ] **Step 1: Write the dependency-free icon generator**

```js
// scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  if (!crc32.table) {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    crc32.table = t;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crc32.table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function writePng(path, size, pixelFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      const px = rowStart + 1 + x * 4;
      raw[px] = r; raw[px + 1] = g; raw[px + 2] = b; raw[px + 3] = a;
    }
  }
  const idat = deflateSync(raw);
  writeFileSync(path, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]));
}

function iconPixel(x, y, size) {
  const navy = [37, 64, 168, 255];
  const white = [255, 255, 255, 255];
  const m = size * 0.22;
  const pageX1 = m, pageX2 = size - m, pageY1 = m * 0.8, pageY2 = size - m * 0.8;
  if (!(x >= pageX1 && x < pageX2 && y >= pageY1 && y < pageY2)) return navy;
  const lineH = size * 0.05;
  const lineGap = size * 0.12;
  const lineX1 = pageX1 + size * 0.08;
  for (let i = 0; i < 3; i++) {
    const ly1 = pageY1 + size * 0.15 + i * lineGap;
    const ly2 = ly1 + lineH;
    const lx2 = i === 2 ? pageX2 - size * 0.2 : pageX2 - size * 0.08;
    if (y >= ly1 && y < ly2 && x >= lineX1 && x < lx2) return navy;
  }
  return white;
}

writePng('icon-512.png', 512, iconPixel);
writePng('icon-192.png', 192, iconPixel);
writePng('apple-touch-icon.png', 180, iconPixel);
console.log('Wrote icon-512.png, icon-192.png, apple-touch-icon.png');
```

- [ ] **Step 2: Run it**

Run: `cd airbnb-permit-generator && node scripts/make-icons.mjs`
Expected: `Wrote icon-512.png, icon-192.png, apple-touch-icon.png`; the three files exist and are non-empty (`ls -la *.png`).

- [ ] **Step 3: Write `manifest.json`**

```json
{
  "name": "Airbnb Permit Generator",
  "short_name": "Permits",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#f6f7fb",
  "theme_color": "#2540a8",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/make-icons.mjs manifest.json icon-192.png icon-512.png apple-touch-icon.png
git commit -m "feat: PWA manifest and generated icons"
```

---

### Task 14: End-to-end manual verification in a real browser

**Files:** none (verification only)

- [ ] **Step 1: Serve the app locally**

Run: `cd airbnb-permit-generator && npx --yes http-server -p 8080 .`
Expected: server starts, reachable at `http://localhost:8080`.

- [ ] **Step 2: In a browser, open `http://localhost:8080`, fill a sample booking** (unit `24J`, registered guest `Juan Dela Cruz`, one companion `Maria Santos`, stay dates a few days apart, draw a signature, attach any image file as each guest's "ID photo"), click **Generate permit**.

Expected: status shows `Generated "Guest Info Sheet - Unit 24J - <date>.pdf"`, a working download link appears. Open the downloaded PDF and visually confirm every field sits on its line (this reproduces the check already done during calibration, now through the real UI).

- [ ] **Step 3: Click Send.**

Expected (desktop browser, no file-sharing support): the PDF and the ID photo both download, and the browser attempts to open a `mailto:` link (may show a "choose an app" prompt or do nothing visible if no mail client is configured — that's expected in a bare test environment; what matters is no JavaScript error appears in the console and the two files did download).

- [ ] **Step 4: Reload the page.**

Expected: Host name, mobile, and unit are pre-filled from what you entered in Step 2 (confirms `localStorage` persistence works).

- [ ] **Step 5: No commit for this task — it's verification only. Note the result in the task tracker / PR description.**

---

### Task 15: Deploy to GitHub Pages

**Files:** none (repo/hosting operations only)

- [ ] **Step 1: Confirm repo visibility with the user before creating it** — GitHub Pages on a free account requires a **public** repository. Nothing sensitive lives in this repo (the blank PDF template and app code only — guest data and ID photos never touch git), but making a new public repo is a "publish public content" action: get an explicit go-ahead from the user for `juanaraullo/airbnb-permit-generator` as public before running the next step.

- [ ] **Step 2: Create the GitHub repo and push**

```bash
cd /Users/johnaraullo/Desktop/CLAUDE/airbnb-permit-generator
gh repo create juanaraullo/airbnb-permit-generator --public --source=. --remote=origin
git branch -M main
git push -u origin main
```
Expected: repo created, push succeeds, `gh repo view juanaraullo/airbnb-permit-generator --web` shows the code.

- [ ] **Step 3: Enable GitHub Pages, serving from `main` branch root**

```bash
gh api -X POST repos/juanaraullo/airbnb-permit-generator/pages \
  -f "source[branch]=main" -f "source[path]=/"
```
Expected: JSON response with `"status":"building"` or similar; no error.

- [ ] **Step 4: Verify the live URL**

Run: `gh api repos/juanaraullo/airbnb-permit-generator/pages --jq .html_url`
Expected: prints `https://juanaraullo.github.io/airbnb-permit-generator/`. Open it in a browser (desktop and iPhone) and repeat the smoke test from Task 14 against the live URL — it must be `https://`, not `http://` or `file://`, for the Web Share and clipboard APIs to work.

- [ ] **Step 5: Tell the user the live URL and suggest they add it to their iPhone home screen** (Safari → Share → Add to Home Screen) so it behaves like an app icon per the PWA manifest from Task 13.

---

## Self-Review Notes

- **Spec coverage:** every workflow step in the design doc (booking form → generate → ID photos → Send with Share-first/mailto-fallback → localStorage defaults → PWA installability → GitHub Pages hosting) has a corresponding task. Error handling section is covered: pdf-lib failure (Task 10's catch), missing guest ID (Task 11's `missingGuestIds` check), share cancel (Task 11's `AbortError` swallow), `localStorage` unavailable (Task 4's try/catch already degrades gracefully; not a hard failure by design).
- **Placeholder scan:** no TBD/TODO; every code step is complete, runnable code.
- **Type/name consistency check:** `fillGuestInfoSheet(PDFLib, templateBytes, formConfig, data)` signature is identical between Task 6 (`filler.js`) and Task 10 (`app.js` call site — `window.PDFLib`, `templateBytes`, `building.form`, data object with matching keys `registeredGuest/stayFrom/stayTo/tower/unit/ownerName/dateSigned/companions/signaturePngBytes`). `missingGuestIds`, `buildEmailSubject`, `buildEmailBody`, `buildFilename`, `buildMailtoUrl`, `canShareFiles`, `loadDefaults`/`saveDefaults` are used in Task 11/12 with the exact parameter shapes defined in Tasks 3–5.
