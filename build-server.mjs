// build-server.mjs
// Bundles the Express/tRPC server for production using esbuild's programmatic API.
// The dynamic import("./vite") in server/_core/index.ts is redirected to
// server/_core/vite.prod.ts (a stub that throws if called in production).
// This avoids bundling the real Vite dev-server code into the production binary.

import { build } from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: ["server/_core/index.ts"],
  platform: "node",
  packages: "external",
  bundle: true,
  format: "esm",
  outdir: "dist",
  // Redirect the ./vite relative import to the production stub
  plugins: [
    {
      name: "alias-vite-dev",
      setup(build) {
        // Match any import of './vite' or '../vite' that resolves inside _core/
        build.onResolve({ filter: /^\.\.?\/vite(\.ts)?$/ }, (args) => {
          // Only redirect when the importer is inside server/_core/
          if (args.importer.includes("server/_core")) {
            return {
              path: path.resolve(__dirname, "server/_core/vite.prod.ts"),
            };
          }
        });
      },
    },
  ],
});

console.log("Server bundle written to dist/index.js");
