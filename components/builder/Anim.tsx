'use client';

import { useEffect } from 'react';

/** Reveals `.dr-anim` elements as they scroll into view. Adds `dr-js` to <html> so content stays visible if scripts fail. */
export default function Anim() {
  useEffect(() => {
    const root = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>('.dr-anim'));
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    root.classList.add('dr-js');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('dr-in'); io.unobserve(e.target); } }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
