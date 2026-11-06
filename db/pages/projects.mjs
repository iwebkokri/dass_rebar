// Projects — re-created from components/ProjectsView.tsx as builder content.
import { w } from '../dsl.mjs';
import { band, ctaBand, head, hero } from '../page-kit.mjs';

export default {
  path: 'projects',
  title: 'Projects',
  seoTitle: 'Projects',
  seoDescription: 'Residential, ICI and infrastructure projects across Ontario reinforced with Dass Rebar steel.',
  content: [
    hero({
      image: '/images/haw-1.jpg',
      crumbs: [['HOME', '/'], ['OUR PROJECTS']],
      title: 'Our projects',
      sub: 'Towers, townhomes, hotels, arenas and industrial builds across Ontario — reinforced with Dass Rebar steel.',
      subMax: '620px',
      end: 0.2,
    }),

    band(
      { bg: '#F4F5F7', pad: 96, g: 40 },
      head('01 — FEATURED', 'Signature projects'),
      w.projects({ source: 'featured', layout: 'detail', cols: { d: 2, t: 1, m: 1 } }),
    ),

    band(
      { bg: '#FFFFFF', top: true, pad: 96, g: 40 },
      head('02 — PORTFOLIO', 'Across Ontario'),
      w.projects({ source: 'others', layout: 'list' }),
    ),

    ctaBand(),
  ],
};
