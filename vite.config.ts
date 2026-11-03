// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { copyFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// The Lovable vite config ships a `lovable:assets-proxy` dev plugin that
// forwards `/__l5e/assets-v1/*` (stored brand artwork referenced by
// `src/assets/homepage/*.asset.json`) to the Lovable preview host. It only
// activates when LOVABLE_PREVIEW_HOST is set, so pin this project's preview
// host here — otherwise every brand logo 404s in local dev.
if (!process.env["LOVABLE_PREVIEW_HOST"]) {
  process.env["LOVABLE_PREVIEW_HOST"] =
    "id-preview--c99f9f9b-a3f0-487a-b8b7-bf8f0309b74d.lovable.app";
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Generate a static index.html shell so the preview works without a running server.
    spa: { enabled: true },
  },
  nitro: {
    output: {
      dir: "dist",
      serverDir: "dist/server",
      publicDir: "dist",
    },
  },
  vite: {
    server: {
      // The preview browser reaches this dev server through one exact
      // hostname; allow only that host (never a blanket allowedHosts rule).
      allowedHosts: [
        "pv-6c4a0adeccea-058b0f96-7978-44e9-b9b9-a3cbc9872708.style.dev",
        "pv-6c4a0adeccea-36f09d23-db9b-4fb8-8569-69f85c8256ee.style.dev",
        "pv-6c4a0adeccea-0e8bb73e-00ef-4429-9ef8-d27ccc07dd89.style.dev",
        "pv-6c4a0adeccea-226b65c8-18e1-4f69-8bd2-bc519947866c.style.dev",
        "pv-6c4a0adeccea-4943851b-ddd6-4c5a-b3e9-84a479e053f6.style.dev",
        "pv-6c4a0adeccea-5d6b8e95-e39f-4085-9462-1d261e7a2c4e.style.dev",
        "pv-6c4a0adeccea-db5a5dc2-bec1-4e0d-aae4-2006b56d13c1.style.dev",
        "pv-6c4a0adeccea-30f8c1f0-0a93-4ad8-8dec-5999f9ec8a1a.style.dev",
        "pv-6c4a0adeccea-3eb2e479-47dc-450f-8363-eb7f447feea9.style.dev",
        "pv-6c4a0adeccea-5c64d229-3b1e-43d1-ab59-43353b3925a3.style.dev",
        "pv-6c4a0adeccea-832ae8b7-59ad-4119-8a86-210b3c9c3ace.style.dev",
        "pv-6c4a0adeccea-39338c94-c6d3-41f0-814b-15c25b0e6197.style.dev",
        "pv-6c4a0adeccea-c3aba940-f33d-4642-813e-deb751607c84.style.dev",
        "pv-6c4a0adeccea-d9a10b1b-6603-4aa2-a603-83d3f5eb5235.style.dev",
      ],
    },
    plugins: [
      {
        name: "spa-shell-index-html",
        apply: "build" as const,
        enforce: "post" as const,
        buildApp: {
          order: "post" as const,
          async handler() {
            const distDir = join(process.cwd(), "dist");
            const shell = join(distDir, "_shell.html");
            const indexHtml = join(distDir, "index.html");
            if (existsSync(shell)) {
              copyFileSync(shell, indexHtml);
            }
            writeFileSync(join(distDir, "_redirects"), "/*  /index.html  200\n");
          },
        },
      },
    ],
  },
});
