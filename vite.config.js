import { defineConfig } from 'vite';
import httpProxy from 'http-proxy';
import react from '@vitejs/plugin-react';
// import { viteStaticCopy } from 'vite-plugin-static-copy';
import { esbuildCommonjs } from '@originjs/vite-plugin-commonjs';
import { viteStaticCopy } from 'vite-plugin-static-copy';

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

const silenceSomeSassDeprecationWarnings = {
  verbose: true,
  logger : {
    warn(message, options) {
      const { stderr } = process;
      const span = options.span ?? undefined;
      const stack = (options.stack === 'null' ? undefined : options.stack) ?? undefined;

      if (options.deprecation) {
        if (message.startsWith('Using / for division outside of calc() is deprecated')) {
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
        stderr.write(`    ${stack.toString().trimEnd().replace(/\n/gm, '\n    ')}\n`);
      }

      stderr.write('\n');
    }
  }
};

export default defineConfig({
  plugins: [
    react(),
    proxyPlugin(),
    viteStaticCopy({
      targets: [
        { src: 'node_modules/quail-wasm/quail.wasm', dest: 'static' },
      ],
    }),
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
        manualChunks(id, { getModuleInfo }) {
          const match = /.*\.strings\.(\w+)\.js/.exec(id);
          if (match) {
            const language = match[1]; // e.g. "en"
            const dependentEntryPoints = [];
        
            // we use a Set here so we handle each module at most once. This
            // prevents infinite loops in case of circular dependencies
            const idsToHandle = new Set(getModuleInfo(id).dynamicImporters);
        
            for (const moduleId of idsToHandle) {
              const { isEntry, dynamicImporters, importers } =
                getModuleInfo(moduleId);
              if (isEntry || dynamicImporters.length > 0) {
                dependentEntryPoints.push(moduleId);
              }
        
              for (const importerId of importers) {
                idsToHandle.add(importerId);
              }
            }
        
            if (dependentEntryPoints.length === 1) {
              return `${
                dependentEntryPoints[0].split('/').slice(-1)[0].split('.')[0]
              }.strings.${language}`;
            }
            // For multiple entries, we put it into a "shared" chunk
            if (dependentEntryPoints.length > 1) {
              return `shared.strings.${language}`;
            }
          }
        },
        chunkFileNames: 'static/js/eqsage-[name].[hash].js',
        entryFileNames: 'static/js/eqsage-[name].[hash].js',
      },
    },
    target   : 'esnext',
    minify   : 'esbuild',
    sourcemap: process.env.NODE_ENV !== 'production',
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

