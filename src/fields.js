export function formatDateLong(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function parseIsoDateLocal(isoDateStr) {
  const [y, m, d] = isoDateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function buildFilename({ unit, stayFromIso }) {
  return `Guest Info Sheet - Unit ${unit} - ${stayFromIso}.png`;
}

export function buildEmailSubject({ subjectCode, unit, stayFromLong, stayToLong }) {
  return `${subjectCode}; room ${unit}; ${stayFromLong}-${stayToLong}`;
}

export function buildEmailBody({ ownerName, ownerMobile, unit, buildingName, stayFromLong, stayToLong, guestNames }) {
  // \r\n rather than a bare \n: several mail apps' iOS share extensions
  // (observed with Gmail) collapse single-\n line breaks in shared plain
  // text into spaces, running every line into one paragraph. CRLF is the
  // line ending plain-text mail bodies use per RFC 5322 and is preserved
  // reliably where bare \n isn't.
  const NL = '\r\n';
  const guestList = (guestNames || []).map((name, i) => `${i + 1}. ${name}`).join(NL);
  return [
    'Hi,',
    '',
    `Please find attached the Guest Information Sheet for Unit ${unit}, ${buildingName}, along with the guests' valid IDs and signed house rules.`,
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

// Attachments are now a single combined multi-select (guest ID photos +
// signed house rules together), so individual photos can no longer be tied
// to a specific guest. The best guardrail available is a count check: you
// need at least one ID photo per named guest, plus one for the house rules.
// Returns how many more photos are needed (0 if there are already enough).
export function attachmentsShortfall(guestCount, attachmentCount) {
  const required = guestCount + 1;
  return Math.max(0, required - attachmentCount);
}
