# Airbnb Permit Generator — Design

## Purpose

Replace a manual paperwork task: for every Airbnb booking at Uptown Parksuites,
the host currently hand-types the Guest Information Sheet and hand-signs it,
then manually emails it plus guest ID photos to the building admin. This tool
collects the same details in a form, fills the real PDF template, and gets the
filled permit plus guest ID photos into an email with as few manual taps as
possible.

## Scope (v1)

- One building: Uptown Parksuites (Asia Affinity Property Management)
- One document: Guest Information Sheet (`GUEST INFO SHEET.pdf`)
- Fields filled: registered guest name, companion guest names (optional),
  duration of stay (from/to), tower/unit, owner (host) name + signature + date
- Fields intentionally left blank: DOB, marital status, age, email, mobile,
  occupation, employment info, vehicle information — not part of the host's
  actual workflow
- Guest ID capture: one photo per guest, held in memory only
- Architecture leaves room to add more buildings later once their PDF
  templates are available — not built into v1 beyond structuring config so a
  building is data, not code

## Non-goals

- No OCR / auto-fill from ID photos (existing prior project had this; not
  requested here — cut for simplicity)
- No accounts, no server, no cross-device sync
- No permit history/audit log (candidate for a later version)

## Architecture

Fully static, client-side web app. No backend.

- **Hosting:** GitHub Pages, repo `juanaraullo/airbnb-permit-generator`,
  served over HTTPS (required for the Web Share API and reliable file
  downloads — a `file://` page cannot do either reliably)
- **Stack:** plain HTML/CSS/JS, no build step, [pdf-lib](https://pdf-lib.js.org/)
  bundled locally for filling the PDF client-side
- **Persistence:** `localStorage` only, for the host's saved defaults (name,
  signature image, tower/unit). Guest names, dates, and ID photos are
  per-session and not persisted — they're one-time-use for a single permit.
- **Installability:** a `manifest.json` + icon so the page can be added to
  the iPhone home screen as an app icon. No service worker / offline caching
  in v1 — not needed since it's used with network access anyway to open Mail.
- **Privacy:** nothing is ever uploaded to any server. Guest ID photos and
  the filled PDF exist only in browser memory and are handed to the OS share
  sheet or downloaded directly — same commitment the prior project made.

## Workflow

1. **Open app** (bookmark or home-screen icon). Form loads with saved host
   name, signature, and tower/unit pre-filled from `localStorage`.
2. **Enter booking details:** registered guest name, optional companion
   names, stay dates (from/to). Tower/unit is editable per booking (host
   manages a couple of units in the building).
3. **Signature:** reuse the saved signature, or draw/upload a new one (canvas
   pad, same UX as the prior project); saving it updates `localStorage`.
4. **Generate:** pdf-lib fills `GUEST INFO SHEET.pdf` with the fields above
   using calibrated coordinates (see below), producing a filled PDF in
   memory. A preview/download link is shown immediately as a safety net.
5. **Guest ID photos:** for each guest entered in step 2, a file input
   (camera or photo library) to attach their ID photo. Required before
   generating the email.
6. **Send:**
   - **If `navigator.canShare` supports files** (modern mobile Safari):
     "Share" button calls `navigator.share({ files: [pdf, ...idPhotos],
     title, text })`. This opens the native Share Sheet with the PDF and all
     ID photos already attached as real files. The user picks Mail; the
     resulting draft has the attachments in place and the shared `text` in
     the body. **Subject and To are not settable through the Share Sheet**
     (an OS/API limitation, not a design gap) — the admin email is shown
     on-screen with a one-tap copy button, and the subject line is short
     enough to type or paste from a copy button too.
   - **Fallback (desktop / unsupported browsers):** downloads the filled PDF
     and each ID photo as files, then opens a `mailto:` link with To/Subject/
     Body pre-filled (matches the prior project's behavior). User drags the
     downloaded files into the opened draft.

## PDF field calibration

`GUEST INFO SHEET.pdf` has a real text layer (not a scanned image), so field
positions are extracted programmatically from the PDF's own text/line
geometry rather than eyeballed. Process, done once during implementation:

1. Extract text/line positions from the PDF to locate each label's baseline
   (e.g. "REGISTERED GUEST:", "DURATION OF STAY FROM", "TOWER:", the
   signature line).
2. Compute fill coordinates just above/after each label.
3. Fill a test permit, render it back to an image, and visually diff against
   the blank template to catch misalignment before calling it done — this
   iteration happens during build, not by asking the host to check pixel
   offsets.

Coordinates live in a config object keyed by building, so adding a second
building later means adding a new config entry + PDF file, not touching the
fill logic.

## Error handling

- If pdf-lib fails to fill/render: show the error inline, keep entered form
  data intact (don't clear the form), do not attempt to open Mail.
- If a guest has no ID photo attached: block "Send" with an inline message
  naming which guest is missing one.
- If `navigator.share` is invoked but the user cancels the Share Sheet: no
  error state needed — that's a normal cancel, form stays as-is so they can
  retry.
- If `localStorage` is unavailable (e.g. private browsing): app still works,
  it just won't remember defaults between visits — no hard failure.

## Testing / verification

- Fill a real test permit end-to-end and visually compare the rendered PDF
  against the blank template for field alignment.
- Verify the Share Sheet path on an actual iPhone (Safari): attachments
  present in the Mail draft, body text present, subject/To empty as
  expected.
- Verify the desktop fallback path in a desktop browser: PDF + photos
  download, `mailto:` draft opens pre-filled.
- Confirm `localStorage` persistence of host name/signature/unit across a
  page reload.
