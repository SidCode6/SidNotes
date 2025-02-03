/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Configure headers for IndexedDB access
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;