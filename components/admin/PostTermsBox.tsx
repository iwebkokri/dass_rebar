'use client';

// Categories (checkbox list, one primary, inline "add new") and tags (comma-separated with suggestions) for the post editor.
// Submits: categories[] (term ids), new_categories[] (names to create), primary_category (id or "new:<name>"), tags ("a, b, c").
import '@/app/admin/css/posts.css';
import { useState } from 'react';

type Cat = { id: number; name: string };
type Props = { categories: Cat[]; selected: number[]; primary: number; tags: string[]; tagSuggestions: string[]; canAddCategory: boolean };

export default function PostTermsBox({ categories, selected, primary: primary0, tags: tags0, tagSuggestions, canAddCategory }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set(selected.map(String)));
  const [added, setAdded] = useState<string[]>([]); // names of categories created inline (not saved yet)
  const [primary, setPrimary] = useState(primary0 ? String(primary0) : '');
  const [draft, setDraft] = useState('');
  const [tags, setTags] = useState(tags0.join(', '));

  const keys = [...categories.map((c) => String(c.id)), ...added.map((n) => `new:${n}`)];
  const on = keys.filter((k) => checked.has(k));
  const effectivePrimary = on.includes(primary) ? primary : on[0] ?? '';

  function toggle(key: string) {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setChecked(next);
  }

  function addCategory() {
    const name = draft.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!name) return;
    const lower = name.toLowerCase();
    const existing = categories.find((c) => c.name.toLowerCase() === lower);
    const dup = added.find((n) => n.toLowerCase() === lower);
    const key = existing ? String(existing.id) : `new:${dup ?? name}`;
    if (!existing && !dup) setAdded([...added, name]);
    setChecked(new Set(checked).add(key));
    setDraft('');
  }

  // ---- tags
  const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
  const typing = tags.includes(',') ? tags.slice(tags.lastIndexOf(',') + 1).trim().toLowerCase() : tags.trim().toLowerCase();
  const suggestions = tagSuggestions
    .filter((s) => !tagList.some((t) => t.toLowerCase() === s.toLowerCase()) && (!typing || s.toLowerCase().includes(typing)))
    .slice(0, 12);
  function addTag(name: string) {
    const finished = !tags.trim() || /,\s*$/.test(tags); // no half-typed tag at the end
    const done = finished ? tagList : tagList.slice(0, -1);
    setTags([...done, name].join(', ') + ', ');
  }

  return (
    <>
      <section className="sc-card po-box">
        <h2>Categories</h2>
        <div className="po-cats" role="group" aria-label="Categories">
          {keys.length === 0 && <span className="sc-muted">No categories yet.</span>}
          {keys.map((key) => {
            const label = key.startsWith('new:') ? key.slice(4) : categories.find((c) => String(c.id) === key)?.name ?? key;
            const isOn = checked.has(key);
            return (
              <div key={key} className="po-cat">
                <label className="sc-check">
                  <input type="checkbox" name={key.startsWith('new:') ? undefined : 'categories'} value={key} checked={isOn} onChange={() => toggle(key)} />
                  <span>{label}{key.startsWith('new:') && <em className="po-new"> new</em>}</span>
                </label>
                {isOn && on.length > 1 && (
                  <label className="po-primary" title="The category shown on the article card">
                    <input type="radio" checked={effectivePrimary === key} onChange={() => setPrimary(key)} /> primary
                  </label>
                )}
                {isOn && key.startsWith('new:') && <input type="hidden" name="new_categories" value={label} />}
              </div>
            );
          })}
        </div>
        <input type="hidden" name="primary_category" value={effectivePrimary} />
        {canAddCategory && (
          <div className="po-add">
            <input
              className="sc-input"
              value={draft}
              maxLength={60}
              placeholder="Add new category"
              aria-label="New category name"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
            />
            <button type="button" className="sc-btn sc-btn-sm" onClick={addCategory}>Add</button>
          </div>
        )}
      </section>

      <section className="sc-card po-box">
        <h2>Tags</h2>
        <input
          className="sc-input"
          name="tags"
          value={tags}
          maxLength={600}
          placeholder="rebar, estimating, CSA"
          aria-label="Tags, separated by commas"
          onChange={(e) => setTags(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        />
        <span className="sc-help">Separate tags with commas. New tags are created when you save.</span>
        {suggestions.length > 0 && (
          <div className="po-suggest" aria-label="Tag suggestions">
            {suggestions.map((s) => (
              <button key={s} type="button" className="po-chip" onClick={() => addTag(s)}>+ {s}</button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
