import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tesvila Operations",
    short_name: "Tesvila",
    description: "Invoice, delivery order, sales and inventory management for Tesvila Pte Ltd",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f8fc",
    theme_color: "#0f4c8a",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
