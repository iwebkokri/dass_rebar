'use client';

// Live preview of the designed emails with sample data: owner notification / customer auto-reply, desktop / phone width.
// The HTML is rendered on the server (lib/email-template.ts) and shown in a sandboxed iframe (no scripts).
import { useState } from 'react';

export default function MailPreview({ owner, autoReply }: { owner: string; autoReply: string }) {
  const [which, setWhich] = useState<'owner' | 'autoreply'>('owner');
  const [width, setWidth] = useState<600 | 375>(600);
  const html = which === 'owner' ? owner : autoReply;
  return (
    <div className="em-preview">
      <div className="em-preview-bar">
        <div className="sc-tabs" style={{ marginBottom: 0 }} role="group" aria-label="Which email">
          <a href="#owner" aria-current={which === 'owner'} onClick={(e) => { e.preventDefault(); setWhich('owner'); }}>Owner notification</a>
          <a href="#autoreply" aria-current={which === 'autoreply'} onClick={(e) => { e.preventDefault(); setWhich('autoreply'); }}>Customer auto-reply</a>
        </div>
        <div className="sc-tabs" style={{ marginBottom: 0 }} role="group" aria-label="Width">
          <a href="#desktop" aria-current={width === 600} onClick={(e) => { e.preventDefault(); setWidth(600); }}>Desktop (600 px)</a>
          <a href="#mobile" aria-current={width === 375} onClick={(e) => { e.preventDefault(); setWidth(375); }}>Phone (375 px)</a>
        </div>
      </div>
      <div className="em-preview-stage">
        <iframe title={`Preview of the ${which === 'owner' ? 'owner notification' : 'customer auto-reply'} email`} srcDoc={html} sandbox="" style={{ width, maxWidth: '100%' }} className="em-preview-frame" />
      </div>
    </div>
  );
}
