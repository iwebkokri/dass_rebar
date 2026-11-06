'use client';

import type { ReactNode } from 'react';

/** Submit button that asks "Are you sure?" first (use inside a <form action={…}>). */
export default function ConfirmButton({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
