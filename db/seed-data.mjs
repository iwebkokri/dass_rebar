// Starter content for the database — a copy of what was hard-coded in the original site.
// Used by `npm run seed` (only fills tables that are empty).

const B = 'https://dassrebar.com/';

// [published_at, category, title, excerpt, article path on dassrebar.com, cover image, featured]
export const POSTS = [
  ['2026-11-03', 'Procurement', 'How to order mechanical rebar couplers correctly', 'A supplier-ready checklist covering bar size, grade, coating, approvals, installation, delivery and receiving.', 'ordering-mechanical-rebar-couplers-procurement-guide/', '/images/p-coupler.jpg', 1],
  ['2026-11-01', 'Estimating', 'Quantity takeoff methods for rebar: from drawing to quote', 'Compare takeoff methods, keep revisions traceable and prepare supplier-ready schedules.', 'quantity-takeoff-methods/', '/images/p-takeoff.jpg', 0],
  ['2026-10-30', 'Detailing', 'Rebar detailing software compared for BIM and fabrication', 'Outputs, BIM, revisions, fabrication hand-offs, licensing and outsourcing options.', 'rebar-detailing-software-buying-guide/', '/images/p-detailing.jpg', 0],
  ['2026-10-28', 'Standards', 'Rebar detailing standards: code, CSA and specifications', 'Shop-drawing requirements, approval roles and fabrication release checks in Ontario.', 'rebar-detailing-standards-ontario-fabrication-release/', '', 0],
  ['2026-10-26', 'Operations', 'Warehouse inventory management for rebar suppliers', 'Controls for traceability and stock status from receiving through delivery.', 'warehouse-inventory-management-rebar/', '', 0],
  ['2026-10-24', 'Consulting', 'What does construction reinforcement consulting include?', 'When to involve support, which documents to prepare and how teams work together.', 'construction-reinforcement-consulting-guide/', '', 0],
  ['2026-10-23', 'Engineering', 'Mechanical splicing couplers vs. lap splices', 'When couplers suit an Ontario concrete project and how they compare with laps.', 'mechanical-splicing-couplers-vs-lap-splices/', '', 0],
  ['2026-10-23', 'Fabrication', 'CNC rebar bending techniques', 'Inputs, tolerances and quality control behind accurate CNC bends.', 'cnc-rebar-bending-techniques/', '', 0],
  ['2026-10-23', 'Operations', '10M rebar inventory management', 'Track 10M bar by project, grade, coating, quantity, status and delivery.', '10m-rebar-inventory-management/', '', 0],
  ['2026-10-22', 'Standards', 'CSA reinforcement standards in Ontario', 'What G30.18, A23.3 and related requirements mean for your project.', 'csa-reinforcement-standards-ontario/', '', 0],
  ['2026-10-22', 'Logistics', 'Rebar tagging systems explained', 'How bar marks, bundle tags and lot records connect fabrication to placement.', 'rebar-tagging-system/', '', 0],
  ['2026-10-20', 'Quality', 'Reinforcement QA inspection: a pre-pour guide', 'Verify documents, materials, cover, spacing and supports before the pour.', 'reinforcement-qa-inspection-ontario-pre-pour-guide/', '', 0],
].map(([published_at, category, title, excerpt, path, cover_image, featured]) => ({
  published_at,
  category,
  title,
  excerpt,
  cover_image,
  featured,
  external_url: B + path,
  slug: path.replace(/\/$/, ''),
}));

// Featured projects (photo galleries). The first image is the main photo.
export const FEATURED_PROJECTS = [
  { title: 'The Hawthorne Residences', category: 'Residential', location: 'Toronto', address: '799 Sheppard Avenue West', images: ['/images/haw-1.jpg', '/images/haw-2.jpg', '/images/haw-3.jpg', '/images/haw-4.jpg'] },
  { title: 'Hickory Terrace', category: 'Residential', location: 'Waterloo', address: '535 Quiet Place', images: ['/images/hic-2.jpg', '/images/hic-1.jpg', '/images/hic-3.jpg', '/images/hic-4.jpg', '/images/hic-5.jpg', '/images/hic-6.jpg'] },
  { title: 'The Grand at Universal City', category: 'Residential', location: 'Pickering', address: 'Pickering, Ontario', images: ['/images/uc-1.jpg', '/images/uc-2.jpg', '/images/uc-3.jpg', '/images/uc-4.jpg', '/images/uc-5.jpg'] },
];

// [title, location]  — the rest of the portfolio (listed without photos)
export const OTHER_PROJECTS = [
  ['1266 Queen St W', 'Toronto'], ['The Pierre', 'Toronto'], ['KP1 King Pine', 'Kitchener'], ['Yonge City Square', 'Yonge St'],
  ['4-10 Beamish Drive', 'Toronto'], ['Manga Hotel', 'Richmond & Camden'], ['45 Agnes St', 'Mississauga'], ['241 Queen St E', 'Brampton'],
  ['255 King St West', 'Cambridge'], ['6 Hanover Rd', 'Brampton'], ['270 Sheppard Ave West', 'Toronto, Ontario'], ['Butler Condos', 'Oakville'],
  ['Motto Condos', 'Mid-rise residential development'], ['3882 Highway 7', 'Markham'], ['Holland Haus', 'Bradford'], ['Industrial Development', '8000 Dixie Road'],
  ['Noble Residences', 'Maple'], ['5 Storey Seniors Home', '5 Baker St, Thorold'], ['Evoke — 310 Unit Residential', 'Kitchener'], ['Parliament Oak Hotel', 'Niagara-on-the-Lake'],
  ['501 Ontario St S', 'Milton, Ontario'], ['Scarborough Gardens Arena', 'Scarborough'], ['Aura Townhomes', 'Lakeview Village'],
];

// Shown as chips under "Also on our roster" on the Home page
export const ROSTER_TITLES = ['The Pierre', 'KP1 King Pine', 'Yonge City Square', 'Butler Condos', 'Parliament Oak Hotel', 'Scarborough Gardens Arena', 'Evoke — 310 Unit Residential', 'Aura Townhomes'];

export const PRODUCTS = [
  { kind: 'stocked', name: 'Grade 400W epoxy-coated rebar', sizes: '10M · 15M · 20M — LARGER ON REQUEST', description: 'Corrosion protection for decks, garages and structures exposed to de-icing salts.', image: '/images/p-epoxy.jpg' },
  { kind: 'stocked', name: 'Glass fibre reinforcing bars', sizes: '10M · 15M — OTHER SIZES ON REQUEST', description: 'GFRP bar that won’t rust or conduct — light to handle and long-lasting.', image: '/images/p-gfrp.jpg' },
  { kind: 'stocked', name: 'Welded wire mesh', sizes: '6″ × 6″ × 6/6 · 9/9 · 10/10', description: 'Flat mesh sheets for slabs on grade, toppings and flatwork.', image: '/images/p-mesh.jpg' },
  { kind: 'also', name: 'Mechanical couplers & terminators', sizes: '', description: '', image: '' },
  { kind: 'also', name: 'Grade 500W rebar — any size', sizes: '', description: '', image: '' },
  { kind: 'also', name: 'Smooth rebar', sizes: '', description: '', image: '' },
];

// [bar size, mass kg/m, nominal diameter mm, area mm², perimeter mm, on request]
export const BAR_DATA = [
  ['10M', 0.785, 11.3, 100, 35.5, 0],
  ['15M', 1.57, 16.0, 200, 50.1, 0],
  ['20M', 2.355, 19.5, 300, 61.3, 0],
  ['25M', 3.925, 25.2, 500, 79.2, 0],
  ['30M', 5.495, 29.9, 700, 93.9, 0],
  ['35M', 7.85, 35.7, 1000, 112.2, 0],
  ['45M', 11.775, 43.7, 1500, 137.3, 1],
  ['55M', 19.625, 56.4, 2500, 177.2, 1],
];

export const SETTINGS = {
  notify_emails: '',
  bar_diagram_nominal: '/images/bar-nominal-diameter.jpg',
  bar_diagram_side: '/images/bar-deformed-side.jpg',
  bar_diagram_actual: '/images/bar-actual-diameter.jpg',
};
