import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";

    const headersList = [
      // Global production security headers (enforces strict HTTPS and defense-in-depth)
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      // Dynamic API protection (prevents edge proxy caching for live telemetry and LLM chatbot)
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
        ],
      },
    ];

    // Aggressive immutable cache-control is only applied in production builds
    // to avoid Next.js dev server warning: "Setting a custom Cache-Control header can break Next.js development behavior."
    if (isProduction) {
      headersList.push(
        // Long-term immutable caching for Next.js static asset bundles (enables Cloudflare Edge cache HIT)
        {
          source: "/_next/static/:path*",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable",
            },
          ],
        },
        // Static media assets caching
        {
          source: "/(favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|woff|woff2))",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable",
            },
          ],
        }
      );
    }

    return headersList;
  },
};

export default nextConfig;
