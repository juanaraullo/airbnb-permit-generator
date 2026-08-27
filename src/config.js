export const BUILDINGS = {
  uptown: {
    name: 'Uptown Parksuites',
    tower: 'Tower 2',
    displayName: 'Uptown Parksuites Tower 2',
    units: ['24J', '8T'],
    adminEmail: 'clientcare.uptownparksuites@asia-affinity.com',
    subjectTemplate: 'UPS T2; room {unit}; {dates}',
    requiresHouseRulesPhoto: true,
    form: {
      docType: 'guestInfoSheet',
      title: 'Guest Information Sheet',
      template: 'templates/uptown-guest-info.pdf',
      pageSize: { width: 612, height: 1008 },
      maxGuests: 6,
      fields: {
        registeredGuest: { x: 197, y: 855, size: 10 },
        stayFrom: { x: 231, y: 738, size: 9 },
        stayTo: { x: 313, y: 738, size: 9 },
        tower: { x: 124, y: 305, size: 9 },
        unit: { x: 229, y: 305, size: 9 },
        ownerNameDate: { x: 210, y: 244, size: 9 },
        signature: { x: 195, y: 256, w: 225, h: 26 },
        companionRows: { x: 90, startY: 563, rowH: 19, max: 5, size: 9 },
      },
    },
  },
  air: {
    name: 'Air Residences',
    tower: '1',
    displayName: 'Air Residences',
    units: ['965', '1116', '2510', '3024', '4061', '4841'],
    adminEmail: 'air.admin@greenmist.ph',
    subjectTemplate: 'AIR {unit} GAF ; {dates}',
    requiresHouseRulesPhoto: false,
    form: {
      docType: 'guestAuthorizationForm',
      title: 'Guest Authorization Form',
      // Points at a pre-rendered blank snapshot of the real template, not
      // the template PDF itself (kept at templates/air-gaf.pdf for
      // reference, unused at runtime). That PDF has a malformed embedded
      // font (pdf.js logs "TT: undefined function") that sends the
      // browser's PDF-to-canvas renderer into a pathologically slow path —
      // measured at ~3.8 minutes to rasterize a single page. The snapshot
      // paid that cost once, offline; at runtime, src/image-filler.js draws
      // guest/host details straight onto it with Canvas2D, so generating a
      // permit here never touches pdf.js at all.
      template: 'templates/air-gaf-blank.png',
      pageSize: { width: 612, height: 792 },
      maxGuests: 4,
      fields: {
        tower: { x: 440, y: 659, size: 9 },
        // The blank between the printed "Unit" and "for" labels is only
        // ~18pt wide — a 4-digit unit at size 8 runs right into "for", so
        // this uses a smaller size to leave real margin on both sides.
        unit: { x: 483, y: 659, size: 6.5 },
        periodFrom: { x: 175, y: 646, size: 8 },
        periodTo: { x: 273, y: 646, size: 8 },
        guestRows: { nameX: 128, proofIdX: 405, relationshipX: 483, startY: 588, rowH: 21, max: 4, size: 8 },
        givenDay: { x: 132, y: 79, size: 8 },
        givenMonth: { x: 175, y: 79, size: 8 },
        // The printed ",20" runs from x=237 to x=249 — x=240 drew the
        // 2-digit year almost on top of it. Starts right after "20" instead,
        // with a smaller size so it still clears the "." at x=259.
        givenYear: { x: 250, y: 79, size: 7 },
        // The printed name sits right on the "Signature over Printed Name"
        // line (measured at y=62), and the signature is drawn well above it
        // instead of overlapping — the old values (name y=58, signature
        // y=60) put both in almost the same 2pt band, crowding into each
        // other.
        ownerName: { x: 400, y: 65, size: 8 },
        signature: { x: 365, y: 70, w: 155, h: 28 },
      },
    },
  },
};
