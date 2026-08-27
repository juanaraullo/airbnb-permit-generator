// Draws guest/host details directly onto a pre-rendered snapshot of a blank
// template image, producing a finished PNG without ever asking pdf.js to
// render the real template PDF at request time. Air Residences' real PDF has
// a malformed embedded font that sends pdf.js's canvas renderer into a
// multi-minute pathological path (see the comment on air.form in config.js);
// the blank snapshot referenced by formConfig.template was rendered once,
// offline, using that same renderer, so the cost is paid only once ever.
//
// Reuses the exact same formConfig.fields coordinates as the pdf-lib-based
// fillGuestAuthorizationForm in filler.js (which still exists purely so
// those coordinates stay covered by precise, text-extraction-based tests —
// pixels drawn here can't be asserted on the same way).
//
// Needs a real browser canvas, so like render.js this can't be unit-tested
// in Node — verify manually in a browser after changes.
export async function fillGuestAuthorizationFormImage(templateImage, formConfig, data) {
  const scale = templateImage.width / formConfig.pageSize.width;
  const pageHeight = formConfig.pageSize.height;

  const canvas = document.createElement('canvas');
  canvas.width = templateImage.width;
  canvas.height = templateImage.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(templateImage, 0, 0);

  const ink = '#0d0d26';

  // PDF coordinates are points measured from the bottom-left of the page;
  // canvas pixels are measured from the top-left, so y needs both a flip
  // and the scale between the template's PDF point size and its pixel size.
  function toCanvasY(pdfY) {
    return (pageHeight - pdfY) * scale;
  }

  function draw(text, x, y, size) {
    if (!text) return;
    ctx.font = `${size * scale}px Helvetica, Arial, sans-serif`;
    ctx.fillStyle = ink;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(text), x * scale, toCanvasY(y));
  }

  const f = formConfig.fields;
  draw(data.tower, f.tower.x, f.tower.y, f.tower.size);
  draw(data.unit, f.unit.x, f.unit.y, f.unit.size);
  draw(data.periodFrom, f.periodFrom.x, f.periodFrom.y, f.periodFrom.size);
  draw(data.periodTo, f.periodTo.x, f.periodTo.y, f.periodTo.size);

  const rows = f.guestRows;
  (data.guests || []).slice(0, rows.max).forEach((guest, i) => {
    const y = rows.startY - i * rows.rowH;
    draw(guest.name, rows.nameX, y, rows.size);
    draw(guest.proofId, rows.proofIdX, y, rows.size);
    draw(guest.relationship, rows.relationshipX, y, rows.size);
    // The "Signature of Guest(s)" column is intentionally left blank — the
    // guests aren't physically present to sign digitally, and the building
    // hasn't required it to be filled in before submission.
  });

  draw(data.givenDay, f.givenDay.x, f.givenDay.y, f.givenDay.size);
  draw(data.givenMonth, f.givenMonth.x, f.givenMonth.y, f.givenMonth.size);
  draw(data.givenYear, f.givenYear.x, f.givenYear.y, f.givenYear.size);
  draw(data.ownerName, f.ownerName.x, f.ownerName.y, f.ownerName.size);

  if (data.signatureImage) {
    const box = f.signature;
    const boxWpx = box.w * scale;
    const boxHpx = box.h * scale;
    const boxTopCanvasY = toCanvasY(box.y + box.h);
    const imgScale = Math.min(boxWpx / data.signatureImage.width, boxHpx / data.signatureImage.height);
    const w = data.signatureImage.width * imgScale;
    const h = data.signatureImage.height * imgScale;
    ctx.drawImage(
      data.signatureImage,
      box.x * scale + (boxWpx - w) / 2,
      boxTopCanvasY + (boxHpx - h) / 2,
      w,
      h
    );
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not export the filled form as an image.'));
    }, 'image/png');
  });
}
