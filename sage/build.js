// build.js
const esbuild = require('esbuild');
const fg = require('fast-glob');

async function build() {
  // Find all .js files in the src folder
  const files = await fg(['lib/**/*.js']);
  // esbuild will determine a common path prefix and preserve the directory structure.
  await esbuild.build({
    entryPoints: files,
    outdir     : 'dist',
    bundle     : false, // ensure files are transpiled individually, not bundled
    // format     : 'esm',
    target     : ['es2020'], // or adjust target as needed
    sourcemap  : true,
    // Optionally, you can set entry names or other options as needed.
  });
  console.log('Build complete');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});