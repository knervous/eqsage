import { defineConfig } from 'vite';
import httpProxy from 'http-proxy';
import react from '@vitejs/plugin-react';
import path from 'path';
import { esbuildCommonjs } from '@originjs/vite-plugin-commonjs';
import { viteStaticCopy } from 'vite-plugin-static-copy';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const proxy = httpProxy.createProxyServer({});

function customProxyMiddleware(context, options) {
  return async (req, res, next) => {
    const target = req.headers['x-remote-api'];

    if (!target) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Error: Missing X-Remote-Api header');
    }

    delete req.headers.host;
    const httpTarget =
      target.startsWith('http://') || target.startsWith('https://')
        ? target
        : `http://${target}`;

    const path = req.headers['x-remote-path'];
    if (path) {
      const r = await fetch(`${httpTarget}${path}`).catch(() => null);
      res.writeHead(200, { 'Content-Type': 'text/plain' });

      if (!r?.ok) {
        res.end(`Proxy error: ${r?.statusText}, ${target}`);
      }
      res.end(await r.text());
      return;
    }

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

      server.middlewares.use(
        '/api/magelo',
        customProxyMiddleware('/api/magelo', {
          changeOrigin: true,
          secure      : false,
        })
      );
    },
  };
}

const silenceSomeSassDeprecationWarnings = {
  verbose: true,
  logger : {
    warn(message, options) {
      const { stderr } = process;
      const span = options.span ?? undefined;
      const stack =
        (options.stack === 'null' ? undefined : options.stack) ?? undefined;

      if (options.deprecation) {
        if (
          message.startsWith(
            'Using / for division outside of calc() is deprecated'
          )
        ) {
          // silences above deprecation warning
          return;
        }
        stderr.write('DEPRECATION ');
      }
      stderr.write(`WARNING: ${message}\n`);

      if (span !== undefined) {
        // output the snippet that is causing this warning
        stderr.write(`\n"${span.text}"\n`);
      }

      if (stack !== undefined) {
        // indent each line of the stack
        stderr.write(
          `    ${stack.toString().trimEnd().replace(/\n/gm, '\n    ')}\n`
        );
      }

      stderr.write('\n');
    },
  },
};

const isElectron = process.env.ELECTRON_BUILD === 'true';
const electronBuildConfig =
  isElectron
    ? {
      base: './',
    }
    : {};


export default defineConfig({
  ...electronBuildConfig,
  plugins: [
    react(),
    proxyPlugin(),
    // viteStaticCopy({
    //   targets: [{ src: 'node_modules/quail-wasm/quail.wasm', dest: 'static' }],
    // }),
    esbuildCommonjs(['spire-api']),
  ],
  optimizeDeps: {
    include: [
      'spire-api',
      '@babylonjs/core',
      '@babylonjs/gui',
      '@babylonjs/inspector',
    ],
  },

  server: {
    headers: {
      'Access-Control-Allow-Origin': 'https://eq.magelo.com',
    },
    client: {
      overlay: {
        errors: true,
      },
    },
    port: 4200,
  },
  build: {
    outDir: isElectron ? 'build': 'dist',
    assetsDir    : 'static',
    rollupOptions: {
      output: {
        chunkFileNames: 'static/js/eqsage-[name].[hash].js',
        entryFileNames: 'static/js/eqsage-[name].[hash].js',
      },
    },
    target   : 'esnext',
    minify   : 'esbuild',
    sourcemap: true, // process.env.NODE_ENV !== 'production',
  },
  worker: {
    format: 'es',
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
      util  : 'util/',
      '@bjs': path.resolve(__dirname, 'src/bjs'),
      '@'   : path.resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        ...silenceSomeSassDeprecationWarnings,
      },
      sass: {
        ...silenceSomeSassDeprecationWarnings,
      },
    },
  },
  define: {
    'process.env': {},
  },
});
