/** @type {import('next').NextConfig} */
const rootDir = import.meta.dirname;

const nextConfig = {
  // This app is self-contained in cockpit/. Pin both trace roots so Next does
  // not infer a parent directory when other lockfiles exist up the tree.
  outputFileTracingRoot: rootDir,
  turbopack: {
    root: rootDir,
  },
};

export default nextConfig;
