import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // the imprint lives on the author's site
  async redirects() {
    return [{ source: "/impressum", destination: "https://www.luiswagener.de/impressum", permanent: false }];
  },
  partialPrefetching: true,
  allowedDevOrigins: ["192.168.178.2"],
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
