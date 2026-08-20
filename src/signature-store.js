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
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  } catch {
    // localStorage can throw (quota exceeded, private browsing) — losing saved
    // defaults is a minor inconvenience, not worth crashing the app over.
  }
}
