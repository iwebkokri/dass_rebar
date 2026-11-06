// Menus: the header navigation (with the Services mega-menu children) and the two footer link columns.
// Source of truth for the old look: components/SiteHeader.tsx and components/SiteFooter.tsx.
export default [
  {
    slug: 'primary',
    name: 'Primary navigation',
    items: [
      {
        label: 'Services',
        url: '/services',
        children: [
          { label: 'Fabrication', url: '/services#fabrication', description: 'Automated cutting and bending' },
          { label: 'Estimating', url: '/services#estimating', description: 'Accurate, detailed cost assessments' },
          { label: 'Detailing', url: '/services#detailing', description: 'Placing drawings and bar lists' },
          { label: 'Project management', url: '/services#management', description: 'Planning through installation' },
          { label: 'Delivery', url: '/services#delivery', description: 'Our own fleet, on schedule' },
          { label: 'Assembly', url: '/services#assembly', description: 'Ready-to-install components' },
          { label: 'Products & bar data →', url: '/products', description: '400W/500W, epoxy, GFRP, mesh', dark: true },
        ],
      },
      { label: 'Products', url: '/products' },
      { label: 'Projects', url: '/projects' },
      { label: 'About', url: '/about' },
      { label: 'Calculator', url: '/calculator' },
      { label: 'Insights', url: '/insights' },
      { label: 'Contact', url: '/contact', sepBefore: true },
      { label: 'Request a quote', url: '/quote', cta: true },
    ],
  },
  {
    slug: 'footer-services',
    name: 'Footer — Services',
    items: [
      { label: 'Fabrication', url: '/services#fabrication' },
      { label: 'Estimating', url: '/services#estimating' },
      { label: 'Detailing', url: '/services#detailing' },
      { label: 'Project management', url: '/services#management' },
      { label: 'Delivery', url: '/services#delivery' },
      { label: 'Assembly', url: '/services#assembly' },
    ],
  },
  {
    slug: 'footer-company',
    name: 'Footer — Company',
    items: [
      { label: 'About us', url: '/about' },
      { label: 'Products & bar data', url: '/products' },
      { label: 'Projects', url: '/projects' },
      { label: 'Rebar calculator', url: '/calculator' },
      { label: 'Insights', url: '/insights' },
      { label: 'Contact', url: '/contact' },
    ],
  },
];
