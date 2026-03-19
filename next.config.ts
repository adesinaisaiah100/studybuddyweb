import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep heavy parsers out of Turbopack server chunks in dev.
  serverExternalPackages: ["pdf2json", "@napi-rs/canvas", "pdfjs-dist"],
};

export default nextConfig;
