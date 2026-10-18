import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin({
  requestConfig: "./src/i18n/request.ts",
  experimental: {
    messages: {
      path: "./src/messages",
      format: "json",
      locales: ["en", "ja", "vi"],
      sourceLocale: "en",
      precompile: true,
    },
  },
});

const nextConfig: NextConfig = {
  // Tailwind styles arrive with the first HTML rather than blocking it on another round trip.
  experimental: { inlineCss: true },
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default withNextIntl(nextConfig);
