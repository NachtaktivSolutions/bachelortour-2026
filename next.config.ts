import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/api/ai-guide", destination: "/api/ai-guide-v2" }
      ],
      afterFiles: [],
      fallback: []
    };
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" }
    ]
  }
};

export default nextConfig;
