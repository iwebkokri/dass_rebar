import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = {
  title: { default: 'Studio CMS', template: '%s · Studio CMS' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="sc">{children}</div>;
}
