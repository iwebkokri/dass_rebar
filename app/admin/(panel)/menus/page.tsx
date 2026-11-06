import type { Metadata } from 'next';
import Link from 'next/link';
import '@/app/admin/css/menus.css';
import { createMenu, deleteMenu } from '@/app/admin/menus/actions';
import ConfirmButton from '@/components/admin/ConfirmButton';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import MenuEditor from '@/components/admin/MenuEditor';
import { requireCap } from '@/lib/auth';
import type { MenuItem } from '@/lib/builder/types';
import { all } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Menus' };

type Props = { searchParams: Promise<FlashParams & { menu?: string }> };

/** Items saved by the seed script have no ids — give them stable ones (by position) so the editor can track them. */
function withIds(list: any, prefix = 'n'): MenuItem[] {
  if (!Array.isArray(list)) return [];
  return list.map((m, i) => ({ ...m, id: typeof m?.id === 'string' && m.id ? m.id : `${prefix}${i}`, children: withIds(m?.children, `${prefix}${i}_`) }));
}

export default async function Menus({ searchParams }: Props) {
  await requireCap('manage_menus');
  const sp = await searchParams;

  const menus = all<{ id: number; name: string; slug: string; items: string }>('SELECT id, name, slug, items FROM menus ORDER BY (slug = \'primary\') DESC, name COLLATE NOCASE');
  const current = menus.find((m) => m.slug === sp.menu) ?? menus[0];
  const pages = all<{ id: number; title: string; path: string }>("SELECT id, title, path FROM pages WHERE status = 'published' ORDER BY (path = '') DESC, title COLLATE NOCASE LIMIT 500");
  const posts = all<{ id: number; title: string; slug: string; external_url: string }>(
    "SELECT id, title, slug, external_url FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 300"
  );

  let items: MenuItem[] = [];
  if (current) {
    try {
      items = withIds(JSON.parse(current.items || '[]'));
    } catch {
      items = [];
    }
  }

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Menus</h1>
          <p>Build navigation menus, then show them with the “Navigation menu” widget in the page builder (or in the header / footer templates).</p>
        </div>
      </div>

      <Flash params={sp} />

      <div className="sc-tabs" role="navigation" aria-label="Choose a menu">
        {menus.map((m) => (
          <Link key={m.id} href={`/admin/menus?menu=${encodeURIComponent(m.slug)}`} aria-current={current?.id === m.id}>{m.name}</Link>
        ))}
      </div>

      <div className="sc-stack">
        {current ? (
          <MenuEditor key={`${current.id}`} menu={{ id: current.id, name: current.name, slug: current.slug, items }} pages={pages} posts={posts} />
        ) : (
          <div className="sc-card sc-empty">No menus yet — create the first one below.</div>
        )}

        <div className="sc-card">
          <h2>Create a new menu</h2>
          <form action={createMenu} className="sc-actions" style={{ alignItems: 'flex-end' }}>
            <div className="sc-field" style={{ flex: '1 1 260px' }}>
              <label htmlFor="menu-name">Menu name</label>
              <input id="menu-name" className="sc-input" name="name" required maxLength={80} placeholder="e.g. Footer — resources" />
            </div>
            <button className="sc-btn sc-btn-primary" type="submit">Create menu</button>
          </form>
        </div>

        {current && current.slug !== 'primary' && (
          <form action={deleteMenu.bind(null, current.id)}>
            <ConfirmButton className="sc-btn sc-btn-danger" message={`Delete the menu “${current.name}”? Widgets that use it will show nothing. This can't be undone.`}>Delete this menu</ConfirmButton>
          </form>
        )}
      </div>
    </>
  );
}
