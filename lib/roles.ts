// Roles & capabilities (WordPress-style). Check with can(user, 'cap') or requireCap('cap') — never compare role names directly.

export type Role = 'administrator' | 'editor' | 'author';
export const ROLES: Role[] = ['administrator', 'editor', 'author'];

export const ROLE_LABEL: Record<Role, string> = { administrator: 'Administrator', editor: 'Editor', author: 'Author' };
export const ROLE_HELP: Record<Role, string> = {
  administrator: 'Everything: users, settings, site-wide templates, menus, forms, redirects, import/export, SEO tools, tracking and custom code.',
  editor: 'Pages and the page builder (including each page’s SEO fields), all posts, media, comments, submissions, projects, products.',
  author: 'Writes and publishes their own posts and uploads media. Cannot touch pages or settings.',
};

export type Cap =
  | 'manage_users'      // add / edit / remove users
  | 'manage_settings'   // site settings, branding, design tokens, SMTP recipients
  | 'manage_site'       // header/footer templates, redirects, forms, import/export, activity log
  | 'manage_menus'
  | 'use_builder'       // open the front-end page builder
  | 'edit_pages'
  | 'publish_pages'
  | 'delete_pages'
  | 'edit_posts'        // create + edit own posts
  | 'edit_others_posts'
  | 'publish_posts'
  | 'delete_posts'
  | 'manage_terms'      // categories / tags
  | 'upload_media'
  | 'edit_others_media'
  | 'moderate_comments'
  | 'view_submissions'
  | 'manage_content'    // projects, products, bar data
  | 'manage_seo'        // site-wide SEO / AI settings, llms.txt, robots, 404 monitor (per-page SEO fields only need edit_pages)
  | 'manage_code'       // tracking IDs + custom CSS / JavaScript / HTML (raw code: administrators only)
  | 'manage_forms'      // build forms and popups (administrators + editors); where leads are emailed stays with manage_email
  | 'manage_email'      // SMTP login, lead-notification recipients, email design + log, per-form recipients / auto-reply (administrators only)
  | 'manage_integrations'; // Lead Manager webhook URL + key and its delivery log (administrators only; the URL contains a secret token)

const ALL: Cap[] = [
  'manage_users', 'manage_settings', 'manage_site', 'manage_menus', 'use_builder', 'edit_pages', 'publish_pages', 'delete_pages',
  'edit_posts', 'edit_others_posts', 'publish_posts', 'delete_posts', 'manage_terms', 'upload_media', 'edit_others_media',
  'moderate_comments', 'view_submissions', 'manage_content', 'manage_seo', 'manage_code', 'manage_forms', 'manage_email', 'manage_integrations',
];

const MATRIX: Record<Role, Cap[]> = {
  administrator: ALL,
  editor: ALL.filter((c) => !['manage_users', 'manage_settings', 'manage_site', 'manage_seo', 'manage_code', 'manage_email', 'manage_integrations'].includes(c)) as Cap[],
  author: ['edit_posts', 'publish_posts', 'delete_posts', 'upload_media'],
};

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as string[]).includes(v);
}

export function roleCan(role: string | undefined | null, cap: Cap): boolean {
  return isRole(role) ? MATRIX[role].includes(cap) : false;
}

export function can(user: { role?: string } | null | undefined, cap: Cap): boolean {
  return !!user && roleCan(user.role, cap);
}
