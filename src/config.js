export const BUILDINGS = {
  uptown: {
    name: 'Uptown Parksuites',
    tower: 'Tower 2',
    units: ['24J', '8T'],
    adminEmail: 'clientcare.uptownparksuites@asia-affinity.com',
    form: {
      title: 'Guest Information Sheet',
      template: 'templates/uptown-guest-info.pdf',
      pageSize: { width: 612, height: 1008 },
      fields: {
        registeredGuest: { x: 197, y: 855, size: 10 },
        stayFrom: { x: 231, y: 738, size: 9 },
        stayTo: { x: 313, y: 738, size: 9 },
        tower: { x: 124, y: 305, size: 9 },
        unit: { x: 229, y: 305, size: 9 },
        ownerNameDate: { x: 210, y: 244, size: 9 },
        signature: { x: 195, y: 246, w: 225, h: 32 },
        companionRows: { x: 90, startY: 563, rowH: 19, max: 5, size: 9 },
      },
    },
  },
};
