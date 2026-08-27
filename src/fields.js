export function formatDateLong(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function parseIsoDateLocal(isoDateStr) {
  const [y, m, d] = isoDateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function buildFilename({ docTitle, unit, stayFromIso, extension }) {
  return `${docTitle} - Unit ${unit} - ${stayFromIso}.${extension}`;
}

// subjectTemplate is a plain string with {unit} and {dates} placeholders,
// since different buildings' admins want genuinely different token order
// (e.g. "CODE; room {unit}; {dates}" vs "AIR {unit} GAF ; {dates}") rather
// than just a different prefix.
export function buildEmailSubject({ subjectTemplate, unit, stayFromLong, stayToLong }) {
  return subjectTemplate
    .replace('{unit}', unit)
    .replace('{dates}', `${stayFromLong}-${stayToLong}`);
}

export function buildEmailBody({ ownerName, ownerMobile, unit, buildingName, docTitle, stayFromLong, stayToLong, guestNames, requiresHouseRulesPhoto }) {
  // \r\n rather than a bare \n: it's the line ending plain-text mail bodies
  // use per RFC 5322, and fixes the paragraph-squishing some iOS mail share
  // extensions do with a bare \n. Confirmed this does NOT fix Gmail's iOS
  // share extension specifically — it collapses every line into one
  // paragraph regardless of line-ending style, a platform-level limitation
  // of that share extension with no known web-code workaround (see the
  // "Send" status message in app.js, which points to "Open Mail app" or
  // "Copy body" as the reliable fallback for Gmail).
  const NL = '\r\n';
  const guestList = (guestNames || []).map((name, i) => `${i + 1}. ${name}`).join(NL);
  const attachmentsLine = requiresHouseRulesPhoto
    ? "the guests' valid IDs and signed house rules"
    : "the guests' valid IDs";
  return [
    'Hi,',
    '',
    `Please find attached the ${docTitle} for Unit ${unit}, ${buildingName}, along with ${attachmentsLine}.`,
    '',
    'Guests: ',
    '',
    guestList,
    '',
    '',
    `Stay: ${stayFromLong} to ${stayToLong}`,
    '',
    'Thank you,',
    ownerName,
    ownerMobile,
  ].join(NL);
}

// Attachments are a single combined multi-select (guest ID photos, plus
// signed house rules where the building requires a separate photo of it),
// so individual photos can no longer be tied to a specific guest. The best
// guardrail available is a count check: one ID photo per named guest, plus
// one more if this building needs a separate house-rules photo. Returns how
// many more photos are needed (0 if there are already enough).
export function attachmentsShortfall(guestCount, attachmentCount, requiresHouseRulesPhoto) {
  const required = guestCount + (requiresHouseRulesPhoto ? 1 : 0);
  return Math.max(0, required - attachmentCount);
}
