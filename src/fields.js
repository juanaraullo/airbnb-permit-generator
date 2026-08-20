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
