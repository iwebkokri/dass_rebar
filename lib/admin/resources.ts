// Definitions that drive the generic list + editor screens in the Studio CMS.
// Adding a field here (and the matching column in lib/db-core.mjs) is all it takes to edit it in the admin.

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'image' | 'gallery';

export type FieldDef = {
  name: string; // database column
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Array<[value: string, label: string]>;
  help?: string;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
  default?: string | number;
  wide?: boolean; // span the full form width
};

export type ColumnKind = 'text' | 'bool' | 'date' | 'thumb' | 'count' | 'badge';

export type Resource = {
  key: string; // URL segment: /admin/<key>
  table: string;
  label: string; // "Insights"
  singular: string; // "article"
  orderBy: string;
  slugFrom?: string; // auto-generate a unique slug from this field
  columns: Array<{ key: string; label: string; kind?: ColumnKind }>;
  fields: FieldDef[];
  publicPath: string; // where the site shows it (for the "View on site" link)
};

export const RESOURCES: Record<string, Resource> = {
  projects: {
    key: 'projects',
    table: 'projects',
    label: 'Projects',
    singular: 'project',
    orderBy: 'featured DESC, sort_order, id',
    slugFrom: 'title',
    publicPath: '/projects',
    columns: [
      { key: 'images', label: '', kind: 'thumb' },
      { key: 'title', label: 'Project' },
      { key: 'location', label: 'Location' },
      { key: 'featured', label: 'Featured', kind: 'bool' },
      { key: 'roster', label: 'On Home roster', kind: 'bool' },
      { key: 'published', label: 'Visible', kind: 'bool' },
      { key: 'sort_order', label: 'Order' },
    ],
    fields: [
      { name: 'title', label: 'Project name', type: 'text', required: true, maxLength: 160, wide: true },
      { name: 'location', label: 'City / location', type: 'text', maxLength: 120, placeholder: 'Toronto' },
      { name: 'address', label: 'Address or detail', type: 'text', maxLength: 160, placeholder: '799 Sheppard Avenue West' },
      { name: 'category', label: 'Tag (featured projects)', type: 'text', maxLength: 40, placeholder: 'Residential', help: 'Small label on the Home page project cards.' },
      { name: 'sort_order', label: 'Order', type: 'number', default: 100, help: 'Lower numbers come first.' },
      { name: 'featured', label: 'Featured project (shown with photos)', type: 'checkbox', help: 'Featured projects get the large photo cards; the rest appear in the “Across Ontario” list. The first three also appear on the Home page.' },
      { name: 'roster', label: 'Show in the Home page “Also on our roster” list', type: 'checkbox' },
      { name: 'published', label: 'Visible on the website', type: 'checkbox', default: 1 },
      { name: 'images', label: 'Photos', type: 'gallery', wide: true, help: '' },
    ],
  },

  products: {
    key: 'products',
    table: 'products',
    label: 'Products',
    singular: 'product',
    orderBy: "CASE kind WHEN 'stocked' THEN 0 ELSE 1 END, sort_order, id",
    publicPath: '/products',
    columns: [
      { key: 'image', label: '', kind: 'thumb' },
      { key: 'name', label: 'Product' },
      { key: 'kind', label: 'Section', kind: 'badge' },
      { key: 'sizes', label: 'Sizes' },
      { key: 'published', label: 'Visible', kind: 'bool' },
      { key: 'sort_order', label: 'Order' },
    ],
    fields: [
      { name: 'name', label: 'Product name', type: 'text', required: true, maxLength: 160, wide: true },
      { name: 'kind', label: 'Section', type: 'select', options: [['stocked', 'Material we stock (card with photo)'], ['also', 'Also supplied (simple list)']], default: 'stocked' },
      { name: 'sort_order', label: 'Order', type: 'number', default: 100, help: 'Lower numbers come first.' },
      { name: 'sizes', label: 'Sizes line', type: 'text', maxLength: 160, wide: true, placeholder: '10M · 15M · 20M — LARGER ON REQUEST', help: 'Small caps line above the name (stocked products).' },
      { name: 'description', label: 'Description', type: 'textarea', rows: 3, maxLength: 400, wide: true },
      { name: 'image', label: 'Photo', type: 'image', wide: true },
      { name: 'published', label: 'Visible on the website', type: 'checkbox', default: 1 },
    ],
  },
};

/** Settings edited on the Settings screen (stored in the `settings` table). */
export const SETTING_FIELDS: FieldDef[] = [
  { name: 'notify_emails', label: 'Send new submissions to', type: 'text', maxLength: 300, wide: true, placeholder: 'sales@dassrebar.com, estimating@dassrebar.com', help: 'Comma-separated. Requires SMTP to be configured on the server (see README); submissions are always saved here either way.' },
  { name: 'bar_diagram_nominal', label: 'Bar data diagram 1 — nominal diameter', type: 'image' },
  { name: 'bar_diagram_side', label: 'Bar data diagram 2 — deformed bar side view', type: 'image' },
  { name: 'bar_diagram_actual', label: 'Bar data diagram 3 — actual (overall) diameter', type: 'image' },
];
