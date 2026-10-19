/** @type {import('next').NextConfig} */
const nextConfig = {
  // lets a second build (e.g. an end-to-end test) live next to the one a dev server is using
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@synccinema/common'],
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Discover is the Home page now. Old links to /dashboard keep working (the old dashboard code is still in src/app/dashboard).
  // Conservative headers that cannot break embeds (YouTube iframes, TMDB/Cloudinary images, WebSockets, checkout redirects):
  // no CSP is enforced here (needs a browser pass first); files under /uploads can never run as a page.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' }
        ]
      },
      { source: '/uploads/:path*', headers: [{ key: 'Content-Security-Policy', value: "default-src 'none'; sandbox" }] }
    ];
  },
  async redirects() {
    return [
      { source: '/dashboard', has: [{ type: 'query', key: 'tab', value: 'games' }], destination: '/games', permanent: false },
      { source: '/dashboard', has: [{ type: 'query', key: 'search', value: '(?<q>.+)' }], destination: '/discover?q=:q', permanent: false },
      { source: '/dashboard', destination: '/discover', permanent: false }
    ];
  }
};

module.exports = nextConfig;
