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

    // Static media assets caching in production (Next.js natively manages /_next/static/ chunk caching)
    if (isProduction) {
      headersList.push({
        source: "/(favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|woff|woff2))",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      });
    }

    return headersList;
  },
};

export default nextConfig;
