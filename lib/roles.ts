// Roles & capabilities (WordPress-style). Check with can(user, 'cap') or requireCap('cap') — never compare role names directly.

export type Role = 'administrator' | 'editor' | 'author';
export const ROLES: Role[] = ['administrator', 'editor', 'author'];

export const ROLE_LABEL: Record<Role, string> = { administrator: 'Administrator', editor: 'Editor', author: 'Author' };
export const ROLE_HELP: Record<Role, string> = {
  administrator: 'Everything: users, settings, site-wide templates, menus, forms, redirects, import/export.',
  editor: 'Pages and the page builder, all posts, media, comments, submissions, projects, products.',
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
  | 'manage_content';   // projects, products, bar data

const ALL: Cap[] = [
  'manage_users', 'manage_settings', 'manage_site', 'manage_menus', 'use_builder', 'edit_pages', 'publish_pages', 'delete_pages',
  'edit_posts', 'edit_others_posts', 'publish_posts', 'delete_posts', 'manage_terms', 'upload_media', 'edit_others_media',
  'moderate_comments', 'view_submissions', 'manage_content',
];

const MATRIX: Record<Role, Cap[]> = {
  administrator: ALL,
  editor: ALL.filter((c) => !['manage_users', 'manage_settings', 'manage_site'].includes(c)) as Cap[],
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
