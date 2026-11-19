import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  devIndicators: false,
  // The matter chat reads uploaded PDFs on the server (lib/adapters/live/
  // document-text.ts); load the PDF reader as-is rather than bundling it.
  serverExternalPackages: ["unpdf"],
};
export default nextConfig;
