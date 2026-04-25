import path from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const sdkEntry = path.resolve(__dirname, "src/lib/vista-sdk/index.mjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  turbopack: {
    resolveAlias: {
      "vista-protocol": "./src/lib/vista-sdk/index.mjs",
    },
  },
  webpack: (config) => {
    config.resolve.alias["vista-protocol"] = sdkEntry;
    return config;
  },
};

export default nextConfig;
