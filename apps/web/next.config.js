/** @type {import('next').NextConfig} */
const nextConfig = {
  // lets a second build (e.g. an end-to-end test) live next to the one a dev server is using
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@synccinema/common'],
  reactStrictMode: false
};

module.exports = nextConfig;
