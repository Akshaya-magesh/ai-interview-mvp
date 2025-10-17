import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  eslint: {
    // only lint YOUR code, not generated stuff
    dirs: ["app", "components", "lib", "pages", "src"],
  },
};

export default withSentryConfig(
  nextConfig,
  {
    org: process.env.SENTRY_ORG ?? "akshayamagesh",
    project: process.env.SENTRY_PROJECT ?? "javascript-nextjs",
    disableLogger: true,
    silent: true,
    automaticVercelMonitors: true,
  }
);
