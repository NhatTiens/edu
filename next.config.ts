import type { NextConfig } from "next";

import { assertPublicKey, configuredOrigin } from "./lib/security/config";
assertPublicKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
assertPublicKey(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
if (process.env.NEXT_PUBLIC_SITE_URL)
  configuredOrigin(process.env.NEXT_PUBLIC_SITE_URL);
const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
