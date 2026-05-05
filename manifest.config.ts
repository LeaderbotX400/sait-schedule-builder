import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "SAIT Schedule Builder",
  version: pkg.version,
  description:
    "Build your ideal class schedule from SAIT's Banner registration system.",
  permissions: ["cookies", "tabs", "storage"],
  host_permissions: ["https://sait-sust-prd-prd1-ban-ss-ssag6.sait.ca/*"],
  background: {
    service_worker: "extension/background.ts",
    type: "module",
  },
  action: {
    default_title: "Open SAIT Schedule Builder",
  },
  icons: {
    "48": "extension/icon48.png",
    "128": "extension/icon128.png",
  },
  web_accessible_resources: [
    {
      resources: ["app.html", "extension/icon48.png", "extension/icon128.png"],
      matches: ["<all_urls>"],
    },
  ],
});
