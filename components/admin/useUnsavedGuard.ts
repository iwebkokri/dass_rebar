'use client';

import { useEffect, useRef } from 'react';

/** "Unsaved changes" guard for editor screens: warns when closing the tab and when clicking any in-app link while `dirty`. */
export default function useUnsavedGuard(dirty: boolean, message = 'You have unsaved changes. Leave without saving?') {
  const ref = useRef(dirty);
  ref.current = dirty;
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!ref.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (!ref.current || e.defaultPrevented) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download') || a.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onClick, true); // capture: runs before Next's <Link> handler
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [message]);
}
