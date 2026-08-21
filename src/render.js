// Rasterizes page 1 of a filled PDF to a PNG image, so the generated permit
// can be shared/attached as a photo instead of a PDF document. Needs a real
// browser canvas to render into, so unlike the rest of src/, this can't be
// unit-tested in Node — verify it manually in a browser after changes.
//
// pdfjsLib is injected (matching the PDFLib injection pattern in filler.js)
// rather than imported globally, so callers control which build is loaded.
export async function renderPdfPageToPngBlob(pdfjsLib, pdfBytes, scale) {
  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  // Fill white first: canvas defaults to transparent, and the source PDF's
  // page background may not paint every pixel opaque, which would otherwise
  // leave stray transparency in the exported PNG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not export the rendered page as an image.'));
    }, 'image/png');
  });
}
