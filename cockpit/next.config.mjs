/** @type {import('next').NextConfig} */
const nextConfig = {
  // This app is self-contained in cockpit/. Pin the file-tracing root so Next
  // doesn't infer a parent directory when other lockfiles exist up the tree.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
