const path = require("node:path");
const { build } = require("esbuild");

async function run() {
  await build({
    entryPoints: [path.join(__dirname, "..", "src", "extension.ts")],
    outfile: path.join(__dirname, "..", "out", "extension.js"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node18",
    external: ["vscode"],
    sourcemap: false,
    minify: false,
    logLevel: "info"
  });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
