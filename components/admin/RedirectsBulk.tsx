'use client';

import type { ReactNode } from 'react';

/** Submit button (inside the list's <form>) with an optional "Are you sure?" and its own name/value. */
export function RedirectsButton({ name, value, message, className, children }: { name: string; value: string; message?: string; className?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      onClick={(e) => {
        if (message && !window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

/** "Select all" tick box for the list (toggles every row checkbox named `ids` in the same form). */
export function RedirectsSelectAll() {
  return (
    <input
      type="checkbox"
      aria-label="Select all redirects"
      onChange={(e) => {
        const form = e.currentTarget.closest('form');
        form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((box) => { box.checked = e.currentTarget.checked; });
      }}
    />
  );
}

export function RedirectsBulkBar() {
  return (
    <div className="sc-redir-bulk">
      <span className="sc-muted">With selected:</span>
      <RedirectsButton name="op" value="enable" className="sc-btn sc-btn-sm">Enable</RedirectsButton>
      <RedirectsButton name="op" value="disable" className="sc-btn sc-btn-sm">Disable</RedirectsButton>
      <RedirectsButton name="op" value="delete" className="sc-btn sc-btn-sm sc-btn-danger" message="Delete the selected redirects? This can't be undone.">Delete</RedirectsButton>
    </div>
  );
}
