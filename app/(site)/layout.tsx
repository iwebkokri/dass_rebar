// The public site's header, content and footer are rendered by components/builder/PageShell (they are builder documents too),
// so this layout only passes children through.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

