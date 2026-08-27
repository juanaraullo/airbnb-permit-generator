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
  if (data.ownerName && data.dateSigned) {
    draw(`${data.ownerName} / ${data.dateSigned}`, f.ownerNameDate.x, f.ownerNameDate.y, f.ownerNameDate.size);
  }

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

// No longer used to produce the app's actual Air Residences output (see
// src/image-filler.js) — kept because this is the only way to verify the
// formConfig.fields coordinates precisely, via pdf.js text-position
// extraction in tests/filler.test.js. The canvas renderer draws pixels onto
// an image and reuses these exact same coordinates, but pixels can't be
// asserted on the same way, so this function's tests double as regression
// coverage for that shared coordinate data.
export async function fillGuestAuthorizationForm(PDFLib, templateBytes, formConfig, data) {
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
