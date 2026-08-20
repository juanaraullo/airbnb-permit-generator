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

export function missingGuestIds(guests) {
  return guests.filter((g) => !g.hasId).map((g) => (g.name ? g.name : '(unnamed guest)'));
}
