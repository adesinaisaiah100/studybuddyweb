import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Keep heavy parsers out of Turbopack server chunks in dev.
  serverExternalPackages: ["pdf2json", "@napi-rs/canvas", "pdfjs-dist"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
