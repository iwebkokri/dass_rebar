/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // lets extra dev servers (tests) run next to the main one: NEXT_DIST_DIR=.next-3301 npx next dev -p 3301
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    // Studio CMS image uploads go through Server Actions (default limit is 1 MB)
    serverActions: {
      bodySizeLimit: '12mb',
      // Only needed if the host's proxy changes the Host header and Studio CMS saves fail with
      // "Invalid Server Actions request". Set ALLOWED_ORIGINS=yourdomain.com,www.yourdomain.com
      allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        // The CMS (and the builder canvas) must never be cached or indexed
        source: '/builder-frame',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // The CMS must never be cached or indexed
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
