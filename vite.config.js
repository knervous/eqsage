import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// import { viteStaticCopy } from 'vite-plugin-static-copy';
import { esbuildCommonjs } from '@originjs/vite-plugin-commonjs';

export default defineConfig({
  plugins: [
    react(),
    // viteStaticCopy({
    //   targets: [
    //     { src: 'node_modules/draco3dgltf/draco_encoder.wasm', dest: '.' },
    //     { src: 'node_modules/draco3dgltf/draco_decoder_gltf.wasm', dest: '.' },
    //   ],
    // }),
    esbuildCommonjs(['spire-api']) // Add any other dependencies as needed

  ],
  optimizeDeps: {
    include: ['spire-api'],
  },
  
  server: {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    client: {
      overlay: {
        warnings: true,
        errors  : true,
      },
    },
    port: 4100
  },
  build: {
    assetsDir    : 'static',
    rollupOptions: {
      output: {
        chunkFileNames: 'static/js/eqsage-[name].[hash].js',
        entryFileNames: 'static/js/eqsage-[name].[hash].js',
      },
    },
    target   : 'esnext',
    sourcemap: true,
  },
  worker: {
    format: 'es',
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
      util  : 'util/',
    },
  },
  define: {
    'process.env': {},
  },
});
