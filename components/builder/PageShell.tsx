// Server component: renders a builder page on the public site — header, content, footer — loading only the data it needs.
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/roles';
import { getActiveTemplate } from '@/lib/pages';
import { collectNeeds } from '@/lib/builder/tree.mjs';
import { loadBuilderData } from '@/lib/builder/data';
import type { BNode } from '@/lib/builder/types';
import { RenderDoc } from './Render';
import AdminBar from './AdminBar';
import Anim from './Anim';

type Props = {
  path: string;
  nodes: BNode[];
  layout?: 'default' | 'canvas';
  page?: { id: number; title: string; status: string };
  /** Rendered between the page content and the footer (used by the post template). */
  after?: React.ReactNode;
  /** Rendered instead of the builder content when set (used by built-in pages like a single post). */
  children?: React.ReactNode;
};

export default async function PageShell({ path, nodes, layout = 'default', page, after, children }: Props) {
  const header = layout === 'canvas' ? null : getActiveTemplate('header');
  const footer = layout === 'canvas' ? null : getActiveTemplate('footer');
  const needs = new Set<string>();
  for (const list of [nodes, header?.doc.nodes, footer?.doc.nodes]) if (list) collectNeeds(list, needs);
  const ctx = { data: loadBuilderData(needs), path };
  const user = await getCurrentUser();

  return (
    <>
      {user && can(user, 'edit_pages') ? <AdminBar user={user} pageId={page?.id} title={page?.title} status={page?.status} /> : user ? <AdminBar user={user} /> : null}
      {header ? <RenderDoc nodes={header.doc.nodes} ctx={ctx} /> : null}
      <main id="main">
        {children ?? <RenderDoc nodes={nodes} ctx={ctx} />}
        {after}
      </main>
      {footer ? <RenderDoc nodes={footer.doc.nodes} ctx={ctx} /> : null}
      <Anim />
    </>
  );
}
