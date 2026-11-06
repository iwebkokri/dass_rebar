'use client';

import type { ReactNode } from 'react';

/**
 * A text-style button for the row actions of the Posts / Comments / Terms lists. It submits the surrounding form
 * with name="op" value="<action>:<id>" (read by the list's server action); optionally asks for confirmation first.
 */
export default function PostRowButton({ op, children, confirm, className = '', name = 'op' }: { op: string; children: ReactNode; confirm?: string; className?: string; name?: string }) {
  return (
    <button
      type="submit"
      name={name}
      value={op}
      className={`po-act ${className}`.trim()}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
