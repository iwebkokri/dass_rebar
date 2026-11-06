'use client';

/** Header checkbox that ticks / unticks every row checkbox (<input name="ids" form="…">) that belongs to the bulk form. */
export default function PostSelectAll({ form, label = 'Select all' }: { form: string; label?: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      onChange={(e) => {
        const on = e.currentTarget.checked;
        document.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="ids"][form="${form}"]`).forEach((c) => { c.checked = on; });
      }}
    />
  );
}
