import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The link preview images read these fonts at request time; make sure Vercel ships them.
  outputFileTracingIncludes: { "/**/opengraph-image": ["./src/assets/fonts/**"] },
  // The site font never changes under the same name, so browsers can keep it for a year.
  async headers() {
    return [{ source: "/fonts/:file*.woff2", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
};

export default nextConfig;
