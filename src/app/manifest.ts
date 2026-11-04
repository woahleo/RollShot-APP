import type { MetadataRoute } from "next";

/** Lets people add Rollshot to their Home Screen, where it opens full screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rollshot",
    short_name: "Rollshot",
    description: "Book car photo and video creators in South Florida.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
