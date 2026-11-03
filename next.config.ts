import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The link preview images read these fonts at request time; make sure Vercel ships them.
  outputFileTracingIncludes: { "/**/opengraph-image": ["./src/assets/fonts/**"] },
};

export default nextConfig;
