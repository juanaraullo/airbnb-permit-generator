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
      // Rendered to a PNG photo before sending — see the 'pdf' note on
      // Air Residences below for why this isn't always possible.
      outputFormat: 'png',
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
      // Stays a PDF rather than being rendered to a PNG photo: this
      // building's real template has a malformed embedded font (pdf.js
      // logs "TT: undefined function") that sends the browser's PDF-to-
      // canvas renderer into a pathologically slow path — measured at
      // ~3.8 minutes to rasterize a single page, unusable for a host
      // waiting on "Generate". Confirmed the fill itself is instant; only
      // the rendering step is affected. Not fixable from this app's code.
      outputFormat: 'pdf',
      title: 'Guest Authorization Form',
      template: 'templates/air-gaf.pdf',
      pageSize: { width: 612, height: 792 },
      maxGuests: 4,
      fields: {
        tower: { x: 440, y: 659, size: 9 },
        unit: { x: 483, y: 659, size: 8 },
        periodFrom: { x: 175, y: 646, size: 8 },
        periodTo: { x: 273, y: 646, size: 8 },
        guestRows: { nameX: 128, proofIdX: 405, relationshipX: 483, startY: 588, rowH: 21, max: 4, size: 8 },
        givenDay: { x: 132, y: 79, size: 8 },
        givenMonth: { x: 175, y: 79, size: 8 },
        givenYear: { x: 240, y: 79, size: 8 },
        ownerName: { x: 400, y: 58, size: 8 },
        signature: { x: 390, y: 60, w: 150, h: 20 },
      },
    },
  },
};
