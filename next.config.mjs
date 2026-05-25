/** @type {import('next').NextConfig} */
const nextConfig = {
  // Our core library uses ESM ".js" import specifiers that point to ".ts"
  // sources (so it runs under tsx/node directly). Teach webpack to resolve
  // those ".js" specifiers to the real ".ts" files.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
