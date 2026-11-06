export type FlashParams = { saved?: string; error?: string; warn?: string };

/** Success / error banners driven by ?saved=1 &error=… &warn=… (set by the server actions' redirects). */
export default function Flash({ params }: { params: FlashParams }) {
  return (
    <>
      {params.error && <div className="sc-flash sc-flash-err" role="alert">{params.error === 'forbidden' ? 'You don’t have permission to open that page.' : params.error.slice(0, 400)}</div>}
      {params.saved && <div className="sc-flash sc-flash-ok" role="status">Saved.</div>}
      {params.warn && <div className="sc-flash sc-flash-warn" role="status">{params.warn.slice(0, 600)}</div>}
    </>
  );
}
