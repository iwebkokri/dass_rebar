// Types shared by the builder renderer, the editor and the server.
export type Device = 'd' | 't' | 'm';
export type Resp<T> = { d?: T; t?: T; m?: T };

export type BNode = { id: string; type: string; props: Record<string, any>; children?: BNode[] };
export type BDoc = { v: number; nodes: BNode[] };

export type MenuItem = {
  id?: string; label: string; url: string; description?: string; newTab?: boolean;
  cta?: boolean;        // render as the call-to-action button
  dark?: boolean;       // highlighted (dark) tile inside a dropdown
  sepBefore?: boolean;  // thin divider before this item in the desktop bar
  children?: MenuItem[];
};

export type FormField = {
  id: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'checkboxes' | 'consent' | 'number' | 'file' | 'date' | 'hidden';
  label: string;
  required?: boolean;
  placeholder?: string;
  /** Small text shown under the field */
  help?: string;
  options?: string[];
  width?: 'full' | 'half';
  /** hidden fields: the value that is stored (always taken from here, never from the browser) */
  value?: string;
  /** email fields: this is the customer's contact address (Reply-To of the lead email) */
  contact?: boolean;
  /** use this answer as the customer's name / email / phone / company / message (CMS list, lead email, Lead Manager) instead of guessing from the label */
  map?: 'name' | 'email' | 'phone' | 'company' | 'message';
};
/** What the PUBLIC widget gets (never includes recipients or auto-reply text). */
export type FormPublicSettings = { submitLabel?: string; successMessage?: string; redirectUrl?: string };
export type FormDef = { id: number; name: string; slug: string; fields: FormField[]; settings: FormPublicSettings };

/** Datasets the server loads for the widgets on a page (see lib/builder/data.ts). Only the ones a page needs are present. */
export type BuilderData = {
  posts?: any[];
  projects?: { featured: any[]; others: any[]; roster: any[]; total: number };
  products?: { stocked: any[]; also: any[] };
  bars?: any[];
  diagrams?: { nominal: string; side: string; actual: string };
  menus?: Record<string, MenuItem[]>;
  forms?: Record<string, FormDef>;
  templates?: Record<string, BNode[]>;
  categories?: { slug: string; name: string }[];
};

/** Handed to widgets while editing in the canvas. Undefined on the public site. */
export type EditApi = {
  selectedId: string | null;
  /** Commit a changed prop (inline editing). */
  setProp: (id: string, key: string, value: any) => void;
  /** Commit a changed prop inside a repeater item. */
  setItemProp: (id: string, key: string, index: number, field: string, value: any) => void;
};

export type BuilderCtx = {
  data: BuilderData;
  edit?: EditApi;
  /** Current URL path without trailing slash ('' for home) — used to mark the active menu item. */
  path?: string;
  settings?: Record<string, string>;
};

export type WidgetProps = { node: BNode; ctx: BuilderCtx };
