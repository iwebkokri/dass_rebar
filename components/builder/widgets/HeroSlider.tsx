'use client';

import { useEffect, useState } from 'react';
import type { WidgetProps } from '@/lib/builder/types';
import { BLink, Txt, asArray, safeMediaUrl } from '../util';

type Slide = { image: string; tab: string; eyebrow: string; heading: string; text: string; btn1Label: string; btn1Url: string; btn2Label: string; btn2Url: string };

export default function HeroSlider({ node, ctx }: WidgetProps) {
  const p = node.props;
  const slides = asArray<Slide>(p.slides);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hover, setHover] = useState(false);
  const n = slides.length;
  const editing = !!ctx.edit;

  useEffect(() => {
    if (editing || !p.autoplay || !playing || hover || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), Math.max(2000, Number(p.interval) || 6500));
    return () => clearInterval(t);
  }, [editing, p.autoplay, p.interval, playing, hover, n]);

  if (!n) return ctx.edit ? <div className="dr-img-ph">Add slides in the panel →</div> : null;
  const cur = Math.min(i, n - 1);

  return (
    <div className="dr-hs" role="group" aria-roledescription="carousel" aria-label="Highlights" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {slides.map((s, k) => {
        const on = k === cur;
        const img = safeMediaUrl(s.image);
        return (
          <div key={k} className="dr-hs-slide" role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${n}`} aria-hidden={!on} data-on={on ? 'true' : 'false'}>
            {img ? <img src={img} alt="" className="dr-hs-img" loading={k === 0 ? 'eager' : 'lazy'} /> : null}
            <div className="dr-hs-ovl" aria-hidden="true" />
            <div className="dr-hs-copy">
              <div className="dr-hs-box">
                <Txt node={node} k="slides" ctx={ctx} as="span" className="dr-hs-eyebrow" item={{ key: 'slides', index: k, field: 'eyebrow' }} multiline={false} placeholder="EYEBROW" />
                <Txt node={node} k="slides" ctx={ctx} as={k === 0 ? 'h1' : 'h2'} className="dr-hs-h" item={{ key: 'slides', index: k, field: 'heading' }} placeholder="Headline" />
                <Txt node={node} k="slides" ctx={ctx} as="p" className="dr-hs-p" item={{ key: 'slides', index: k, field: 'text' }} placeholder="Supporting text" />
                {(s.btn1Label || s.btn2Label || editing) && (
                  <div className="dr-hs-btns">
                    {(s.btn1Label || editing) && (
                      <BLink href={s.btn1Url} ctx={ctx} className="dr-btn dr-btn--solid dr-btn--md">
                        <Txt node={node} k="slides" ctx={ctx} as="span" item={{ key: 'slides', index: k, field: 'btn1Label' }} multiline={false} placeholder="Button" />
                      </BLink>
                    )}
                    {(s.btn2Label || editing) && (
                      <BLink href={s.btn2Url} ctx={ctx} className="dr-btn dr-btn--ghost dr-btn--md">
                        <Txt node={node} k="slides" ctx={ctx} as="span" item={{ key: 'slides', index: k, field: 'btn2Label' }} multiline={false} placeholder="Second button" />
                      </BLink>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {n > 1 && (
        <div className="dr-hs-bar">
          <div className="dr-hs-tabs" style={{ gridTemplateColumns: `repeat(${Math.min(n, 4)}, minmax(0, 1fr))` }}>
            {slides.map((s, k) => (
              <button key={k} type="button" className="dr-hs-tab" data-on={k === cur ? 'true' : 'false'} onClick={() => setI(k)} aria-label={`Show slide ${k + 1}: ${s.tab}`}>
                <span className="dr-hs-num">{String(k + 1).padStart(2, '0')}</span>
                {s.tab}
              </button>
            ))}
          </div>
          <div className="dr-hs-ctl">
            <button type="button" className="dr-hs-round" onClick={() => setPlaying((v) => !v)} aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}>
              {playing ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8V4z" /></svg>
              )}
            </button>
            <button type="button" className="dr-hs-round" onClick={() => setI((cur + n - 1) % n)} aria-label="Previous slide">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button type="button" className="dr-hs-round dr-hs-round--solid" onClick={() => setI((cur + 1) % n)} aria-label="Next slide">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
