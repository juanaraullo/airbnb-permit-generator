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
