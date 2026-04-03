import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api/banner": {
        target:
          "https://sait-sust-prd-prd1-ban-ss-ssag6.sait.ca/StudentRegistrationSsb",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/banner/, ""),
        secure: true,
        cookieDomainRewrite: "localhost",
        configure: (proxy) => {
          // The browser's Fetch API silently strips "Cookie" (a forbidden header).
          // We send credentials via custom X-Banner-* headers and rewrite them
          // here into the real headers that Banner expects and validates.
          proxy.on("proxyReq", (proxyReq) => {
            const cookies = proxyReq.getHeader("x-banner-cookies");
            if (cookies) {
              proxyReq.setHeader("Cookie", cookies);
              proxyReq.removeHeader("x-banner-cookies");
            }

            const syncToken = proxyReq.getHeader("x-banner-sync-token");
            if (syncToken) {
              proxyReq.setHeader("X-Synchronizer-Token", syncToken);
              proxyReq.removeHeader("x-banner-sync-token");
            }

            // Banner validates the Referer header
            const referer = proxyReq.getHeader("x-banner-referer");
            if (referer) {
              proxyReq.setHeader("Referer", referer);
              proxyReq.removeHeader("x-banner-referer");
            }

            // Some POST endpoints need the real Origin
            const origin = proxyReq.getHeader("x-banner-origin");
            if (origin) {
              proxyReq.setHeader("Origin", origin);
              proxyReq.removeHeader("x-banner-origin");
            }
          });
        },
      },
    },
  },
});
