import { defineConfig } from 'vite';
import httpProxy from 'http-proxy';
import react from '@vitejs/plugin-react';
// import { viteStaticCopy } from 'vite-plugin-static-copy';
import { esbuildCommonjs } from '@originjs/vite-plugin-commonjs';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const proxy = httpProxy.createProxyServer({});

function customProxyMiddleware(context, options) {
  return (req, res, next) => {
    const target = req.headers['x-remote-api'];

    if (!target) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Error: Missing X-Remote-Api header');
    }

    delete req.headers.host;
    const httpTarget = target.startsWith('http://') ? target : `http://${target}`;


    proxy.web(
      req,
      res,
      { target: `${httpTarget}${context}`, changeOrigin: true, secure: false },
      (error) => {
        console.error('Proxy error:', error);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Proxy error: ${error.message}, ${target}`);
      }
    );
  };
}

function proxyPlugin() {
  return {
    name: 'my-proxy-plugin',
    configureServer(server) {
      server.middlewares.use(
        '/auth/login',
        customProxyMiddleware('/auth/login', {
          changeOrigin: true,
          secure      : false,
        })
      );

      server.middlewares.use(
        '/api/v1',
        customProxyMiddleware('/api/v1', {
          changeOrigin: true,
          secure      : false,
        })
      );
    },
  };
}


export default defineConfig({
  plugins: [
    react(),
    proxyPlugin(),
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
        errors: true,
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
