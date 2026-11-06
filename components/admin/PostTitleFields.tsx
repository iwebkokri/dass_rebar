'use client';

// Title + permalink slug. For a new post the slug follows the title until the author edits it by hand.
import '@/app/admin/css/posts.css';
import { useState } from 'react';
import { slugify } from '@/lib/slug.mjs';

type Props = { title: string; slug: string; isNew: boolean; excerpt: string };

export default function PostTitleFields({ title: t0, slug: s0, isNew, excerpt: x0 }: Props) {
  const [title, setTitle] = useState(t0);
  const [slug, setSlug] = useState(s0);
  const [touched, setTouched] = useState(!isNew);
  const [excerpt, setExcerpt] = useState(x0);

  return (
    <div className="po-fields">
      <div className="sc-field">
        <label htmlFor="po-title">Title <span className="sc-req">*</span></label>
        <input
          className="sc-input po-title"
          id="po-title"
          name="title"
          required
          maxLength={200}
          autoFocus={isNew}
          placeholder="Article title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!touched) setSlug(e.target.value.trim() ? slugify(e.target.value) : '');
          }}
        />
      </div>
      <div className="sc-field">
        <label htmlFor="po-slug">Slug</label>
        <div className="po-slug">
          <span aria-hidden>/insights/</span>
          <input
            className="sc-input"
            id="po-slug"
            name="slug"
            maxLength={120}
            value={slug}
            placeholder="created-from-the-title"
            onChange={(e) => {
              setTouched(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'));
            }}
          />
        </div>
        <span className="sc-help">The web address of the article. If it is already taken, a number is added automatically. Changing it later breaks old links.</span>
      </div>
      <div className="sc-field">
        <label htmlFor="po-excerpt">Excerpt</label>
        <textarea
          className="sc-textarea"
          id="po-excerpt"
          name="excerpt"
          rows={3}
          maxLength={600}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="One or two sentences shown on the article card and under the title."
        />
        <span className="sc-help">{excerpt.length} / 600</span>
      </div>
    </div>
  );
}
