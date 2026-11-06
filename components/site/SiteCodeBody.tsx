// Raw administrator-entered HTML for the two <body> locations. It is written into the server-rendered HTML as it is, so
// <script> tags in it are real script tags the browser runs while it parses the page. (display: contents = no layout effect.)
export default function SiteCodeBody({ id, html }: { id: string; html: string }) {
  if (!html) return null;
  return <div id={id} style={{ display: 'contents' }} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}
