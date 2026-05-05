import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "SAIT Schedule Builder",
  version: pkg.version,
  description: "Build your ideal class schedule from SAIT's Banner registration system.",
  permissions: ["cookies", "tabs", "storage"],
  host_permissions: ["https://*.sait.ca/*"],
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
      resources: ["index.html", "extension/icon48.png", "extension/icon128.png"],
      matches: ["<all_urls>"],
    },
  ],
  externally_connectable: {
    matches: [
      "http://localhost/*",
      "http://localhost:*/*",
      "http://127.0.0.1/*",
      "http://127.0.0.1:*/*",
      "https://*.sait-scheduler.pages.dev/*",
    ],
  },
  content_scripts: [
    {
      matches: [
        "http://localhost/*",
        "http://localhost:*/*",
        "http://127.0.0.1/*",
        "http://127.0.0.1:*/*",
        "https://*.sait-scheduler.pages.dev/*",
      ],
      js: ["extension/inject.ts"],
      run_at: "document_start",
      all_frames: false,
    },
  ],
});

// import { defineManifest } from "@crxjs/vite-plugin";
// import pkg from "./package.json" with { type: "json" };

// export default defineManifest({
//   manifest_version: 3,
//   name: "SAIT Schedule Builder",
//   version: pkg.version,
//   description:
//     "Build your ideal class schedule from SAIT's Banner registration system.",
//   permissions: ["cookies", "tabs", "storage"],
//   host_permissions: [
//     "https://sait-sust-prd-prd1-ban-ss-ssag6.sait.ca/*",
//     "https://sait-sust-prd-prd1-ban-ss-ssag2.sait.ca/*",
//     "https://sait-sust-prd-prd1-ban-ss-ssag1.sait.ca/*",
//   ],
//   background: {
//     service_worker: "extension/background.ts",
//     type: "module",
//   },
//   content_scripts: [
//     {
//       matches: ["https://*.sait.ca/StudentRegistrationSsb/*"],
//       js: ["extension/content.ts"],
//       run_at: "document_idle",
//     },
//     {
//       matches: [
//         "http://localhost/*",
//         "http://localhost:*/*",
//         "http://127.0.0.1/*",
//         "http://127.0.0.1:*/*",
//         "https://*.sait-scheduler.pages.dev/*",
//       ],
//       js: ["extension/inject.ts"],
//       run_at: "document_start",
//       all_frames: false,
//     },
//   ],
//   externally_connectable: {
//     matches: [
//       "http://localhost/*",
//       "http://localhost:*/*",
//       "http://127.0.0.1/*",
//       "http://127.0.0.1:*/*",
//       "https://*.sait-scheduler.pages.dev/*",
//     ],
//   },
//   action: {
//     default_title: "Open SAIT Schedule Builder",
//   },
//   icons: {
//     "48": "extension/icon48.png",
//     "128": "extension/icon128.png",
//   },
//   web_accessible_resources: [
//     {
//       resources: [
//         "index.html",
//         "extension/icon48.png",
//         "extension/icon128.png",
//       ],
//       matches: ["<all_urls>"],
//     },
//   ],
// });
