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
  return `${subjectCode}; GIS; ${unit}; ${stayFromLong}-${stayToLong}`;
}

export function buildEmailBody({ ownerName, ownerMobile, unit, buildingName, stayFromLong, stayToLong, guestNames }) {
  const guestLine = guestNames && guestNames.length ? guestNames.join(', ') : '';
  return `Hi,\n\nPlease find attached the Guest Information Sheet for Unit ${unit}, ${buildingName}, along with the guests' valid IDs and signed house rules.\n\nGuests: ${guestLine}\nStay: ${stayFromLong} to ${stayToLong}\n\nThank you,\n${ownerName}\n${ownerMobile}`;
}

export function missingGuestIds(guests) {
  return guests.filter((g) => !g.hasId).map((g) => (g.name ? g.name : '(unnamed guest)'));
}
