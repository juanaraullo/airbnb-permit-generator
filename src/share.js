export function canShareFiles(nav) {
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    const probe = new File(['x'], 'probe.png', { type: 'image/png' });
    return nav.canShare({ files: [probe] }) === true;
  } catch {
    return false;
  }
}

export function buildMailtoUrl({ to, subject, body }) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
