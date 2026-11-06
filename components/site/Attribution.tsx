'use client';

// Records where the visitor came from (utm_* parameters, landing page, referrer) on the first public page of their session, so a form
// they submit later can carry it (lib/attribution.ts). Renders nothing; only mounted by the public PageShell (never in /admin or the builder).
import { useEffect } from 'react';
import { captureAttribution } from '@/lib/attribution';

export default function Attribution() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
