import { safeJsonLd } from '@/lib/builder/seo-schema.mjs';

/** One <script type="application/ld+json"> per object. The JSON is escaped so it can never close the script element. */
export default function JsonLd({ data }: { data: object[] }) {
  return (
    <>
      {data.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(d) }} />
      ))}
    </>
  );
}
