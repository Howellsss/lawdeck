import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/securityHeaders";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // "Terms of Use" and "Terms of Service" are one document (founder, 2026-11-13): both addresses open it.
  async redirects() {
    return [{ source: "/terms-of-use", destination: "/terms", permanent: true }];
  },
  // Security headers on every page and file (step 7g): see src/lib/securityHeaders.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NODE_ENV === "development"),
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
