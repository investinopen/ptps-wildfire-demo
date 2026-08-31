import { build, context } from "esbuild";
import { cp, mkdir } from "node:fs/promises";

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["src/background.ts"],
  bundle: true,
  outfile: "dist/background.js",
  target: ["chrome109", "firefox115"],
  format: "esm",
  sourcemap: true,
};

async function copyStaticFiles() {
  await mkdir("dist", { recursive: true });
  await cp("manifest.json", "dist/manifest.json");
}

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  await copyStaticFiles();
  console.log("Watching for changes...");
} else {
  await build(options);
  await copyStaticFiles();
}
