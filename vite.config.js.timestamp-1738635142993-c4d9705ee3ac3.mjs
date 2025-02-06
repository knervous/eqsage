// vite.config.js
import { defineConfig } from "file:///Users/Paul/source/eqsage/node_modules/vite/dist/node/index.js";
import httpProxy from "file:///Users/Paul/source/eqsage/node_modules/http-proxy/index.js";
import react from "file:///Users/Paul/source/eqsage/node_modules/@vitejs/plugin-react/dist/index.mjs";
import path from "path";
import { esbuildCommonjs } from "file:///Users/Paul/source/eqsage/node_modules/@originjs/vite-plugin-commonjs/lib/index.js";
import { viteStaticCopy } from "file:///Users/Paul/source/eqsage/node_modules/vite-plugin-static-copy/dist/index.js";
var __vite_injected_original_dirname = "/Users/Paul/source/eqsage";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
var proxy = httpProxy.createProxyServer({});
function customProxyMiddleware(context, options) {
  return (req, res, next) => {
    const target = req.headers["x-remote-api"];
    if (!target) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      return res.end("Error: Missing X-Remote-Api header");
    }
    delete req.headers.host;
    const httpTarget = target.startsWith("http://") ? target : `http://${target}`;
    proxy.web(
      req,
      res,
      { target: `${httpTarget}${context}`, changeOrigin: true, secure: false },
      (error) => {
        console.error("Proxy error:", error);
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end(`Proxy error: ${error.message}, ${target}`);
      }
    );
  };
}
function proxyPlugin() {
  return {
    name: "my-proxy-plugin",
    configureServer(server) {
      server.middlewares.use(
        "/auth/login",
        customProxyMiddleware("/auth/login", {
          changeOrigin: true,
          secure: false
        })
      );
      server.middlewares.use(
        "/api/v1",
        customProxyMiddleware("/api/v1", {
          changeOrigin: true,
          secure: false
        })
      );
    }
  };
}
var silenceSomeSassDeprecationWarnings = {
  verbose: true,
  logger: {
    warn(message, options) {
      const { stderr } = process;
      const span = options.span ?? void 0;
      const stack = (options.stack === "null" ? void 0 : options.stack) ?? void 0;
      if (options.deprecation) {
        if (message.startsWith(
          "Using / for division outside of calc() is deprecated"
        )) {
          return;
        }
        stderr.write("DEPRECATION ");
      }
      stderr.write(`WARNING: ${message}
`);
      if (span !== void 0) {
        stderr.write(`
"${span.text}"
`);
      }
      if (stack !== void 0) {
        stderr.write(
          `    ${stack.toString().trimEnd().replace(/\n/gm, "\n    ")}
`
        );
      }
      stderr.write("\n");
    }
  }
};
var vite_config_default = defineConfig({
  plugins: [
    react(),
    proxyPlugin(),
    viteStaticCopy({
      targets: [{ src: "node_modules/quail-wasm/quail.wasm", dest: "static" }]
    }),
    esbuildCommonjs(["spire-api"])
  ],
  optimizeDeps: {
    include: ["spire-api", "@babylonjs/core", "@babylonjs/gui", "@babylonjs/inspector"]
  },
  server: {
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    client: {
      overlay: {
        errors: true
      }
    },
    port: 4100
  },
  build: {
    assetsDir: "static",
    rollupOptions: {
      output: {
        // manualChunks(id, { getModuleInfo }) {
        //   if (id.includes('node_modules')) {
        //     if (id.includes('@babylonjs/core')) {
        //       return '@babylonjs/core';
        //     }
        //     if (id.includes('@babylonjs/gui-editor')) {
        //       return '@babylonjs/gui-editor';
        //     }
        //     if (id.includes('@babylonjs/gui')) {
        //       return '@babylonjs/gui';
        //     }
        //     if (id.includes('@babylonjs/inspector')) {
        //       return '@babylonjs/inspector';
        //     }
        //     return id.toString().split('node_modules/')[1].split('/')[0].toString();
        //   }
        //   const match = /.*\.strings\.(\w+)\.js/.exec(id);
        //   if (match) {
        //     const language = match[1]; // e.g. "en"
        //     const dependentEntryPoints = [];
        //     // we use a Set here so we handle each module at most once. This
        //     // prevents infinite loops in case of circular dependencies
        //     const idsToHandle = new Set(getModuleInfo(id).dynamicImporters);
        //     for (const moduleId of idsToHandle) {
        //       const { isEntry, dynamicImporters, importers } =
        //         getModuleInfo(moduleId);
        //       if (isEntry || dynamicImporters.length > 0) {
        //         dependentEntryPoints.push(moduleId);
        //       }
        //       for (const importerId of importers) {
        //         idsToHandle.add(importerId);
        //       }
        //     }
        //     if (dependentEntryPoints.length === 1) {
        //       return `${
        //         dependentEntryPoints[0].split('/').slice(-1)[0].split('.')[0]
        //       }.strings.${language}`;
        //     }
        //     // For multiple entries, we put it into a "shared" chunk
        //     if (dependentEntryPoints.length > 1) {
        //       return `shared.strings.${language}`;
        //     }
        //   }
        // },
        chunkFileNames: "static/js/eqsage-[name].[hash].js",
        entryFileNames: "static/js/eqsage-[name].[hash].js"
      }
    },
    target: "esnext",
    minify: "esbuild",
    sourcemap: true
    // process.env.NODE_ENV !== 'production',
  },
  worker: {
    format: "es"
  },
  resolve: {
    alias: {
      buffer: "buffer/",
      util: "util/",
      "@bjs": path.resolve(__vite_injected_original_dirname, "src/bjs"),
      "@": path.resolve(__vite_injected_original_dirname, "src")
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        ...silenceSomeSassDeprecationWarnings
      },
      sass: {
        ...silenceSomeSassDeprecationWarnings
      }
    }
  },
  define: {
    "process.env": {}
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvUGF1bC9zb3VyY2UvZXFzYWdlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvUGF1bC9zb3VyY2UvZXFzYWdlL3ZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9QYXVsL3NvdXJjZS9lcXNhZ2Uvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCBodHRwUHJveHkgZnJvbSAnaHR0cC1wcm94eSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBlc2J1aWxkQ29tbW9uanMgfSBmcm9tICdAb3JpZ2luanMvdml0ZS1wbHVnaW4tY29tbW9uanMnO1xuaW1wb3J0IHsgdml0ZVN0YXRpY0NvcHkgfSBmcm9tICd2aXRlLXBsdWdpbi1zdGF0aWMtY29weSc7XG5cbnByb2Nlc3MuZW52Lk5PREVfVExTX1JFSkVDVF9VTkFVVEhPUklaRUQgPSAwO1xuY29uc3QgcHJveHkgPSBodHRwUHJveHkuY3JlYXRlUHJveHlTZXJ2ZXIoe30pO1xuXG5mdW5jdGlvbiBjdXN0b21Qcm94eU1pZGRsZXdhcmUoY29udGV4dCwgb3B0aW9ucykge1xuICByZXR1cm4gKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgY29uc3QgdGFyZ2V0ID0gcmVxLmhlYWRlcnNbJ3gtcmVtb3RlLWFwaSddO1xuXG4gICAgaWYgKCF0YXJnZXQpIHtcbiAgICAgIHJlcy53cml0ZUhlYWQoNDAwLCB7ICdDb250ZW50LVR5cGUnOiAndGV4dC9wbGFpbicgfSk7XG4gICAgICByZXR1cm4gcmVzLmVuZCgnRXJyb3I6IE1pc3NpbmcgWC1SZW1vdGUtQXBpIGhlYWRlcicpO1xuICAgIH1cblxuICAgIGRlbGV0ZSByZXEuaGVhZGVycy5ob3N0O1xuICAgIGNvbnN0IGh0dHBUYXJnZXQgPSB0YXJnZXQuc3RhcnRzV2l0aCgnaHR0cDovLycpXG4gICAgICA/IHRhcmdldFxuICAgICAgOiBgaHR0cDovLyR7dGFyZ2V0fWA7XG5cbiAgICBwcm94eS53ZWIoXG4gICAgICByZXEsXG4gICAgICByZXMsXG4gICAgICB7IHRhcmdldDogYCR7aHR0cFRhcmdldH0ke2NvbnRleHR9YCwgY2hhbmdlT3JpZ2luOiB0cnVlLCBzZWN1cmU6IGZhbHNlIH0sXG4gICAgICAoZXJyb3IpID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcignUHJveHkgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICByZXMud3JpdGVIZWFkKDQwNCwgeyAnQ29udGVudC1UeXBlJzogJ3RleHQvcGxhaW4nIH0pO1xuICAgICAgICByZXMuZW5kKGBQcm94eSBlcnJvcjogJHtlcnJvci5tZXNzYWdlfSwgJHt0YXJnZXR9YCk7XG4gICAgICB9XG4gICAgKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcHJveHlQbHVnaW4oKSB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ215LXByb3h5LXBsdWdpbicsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcbiAgICAgICAgJy9hdXRoL2xvZ2luJyxcbiAgICAgICAgY3VzdG9tUHJveHlNaWRkbGV3YXJlKCcvYXV0aC9sb2dpbicsIHtcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgc2VjdXJlICAgICAgOiBmYWxzZSxcbiAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXG4gICAgICAgICcvYXBpL3YxJyxcbiAgICAgICAgY3VzdG9tUHJveHlNaWRkbGV3YXJlKCcvYXBpL3YxJywge1xuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICBzZWN1cmUgICAgICA6IGZhbHNlLFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9LFxuICB9O1xufVxuXG5jb25zdCBzaWxlbmNlU29tZVNhc3NEZXByZWNhdGlvbldhcm5pbmdzID0ge1xuICB2ZXJib3NlOiB0cnVlLFxuICBsb2dnZXIgOiB7XG4gICAgd2FybihtZXNzYWdlLCBvcHRpb25zKSB7XG4gICAgICBjb25zdCB7IHN0ZGVyciB9ID0gcHJvY2VzcztcbiAgICAgIGNvbnN0IHNwYW4gPSBvcHRpb25zLnNwYW4gPz8gdW5kZWZpbmVkO1xuICAgICAgY29uc3Qgc3RhY2sgPVxuICAgICAgICAob3B0aW9ucy5zdGFjayA9PT0gJ251bGwnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5zdGFjaykgPz8gdW5kZWZpbmVkO1xuXG4gICAgICBpZiAob3B0aW9ucy5kZXByZWNhdGlvbikge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgbWVzc2FnZS5zdGFydHNXaXRoKFxuICAgICAgICAgICAgJ1VzaW5nIC8gZm9yIGRpdmlzaW9uIG91dHNpZGUgb2YgY2FsYygpIGlzIGRlcHJlY2F0ZWQnXG4gICAgICAgICAgKVxuICAgICAgICApIHtcbiAgICAgICAgICAvLyBzaWxlbmNlcyBhYm92ZSBkZXByZWNhdGlvbiB3YXJuaW5nXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHN0ZGVyci53cml0ZSgnREVQUkVDQVRJT04gJyk7XG4gICAgICB9XG4gICAgICBzdGRlcnIud3JpdGUoYFdBUk5JTkc6ICR7bWVzc2FnZX1cXG5gKTtcblxuICAgICAgaWYgKHNwYW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyBvdXRwdXQgdGhlIHNuaXBwZXQgdGhhdCBpcyBjYXVzaW5nIHRoaXMgd2FybmluZ1xuICAgICAgICBzdGRlcnIud3JpdGUoYFxcblwiJHtzcGFuLnRleHR9XCJcXG5gKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHN0YWNrICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gaW5kZW50IGVhY2ggbGluZSBvZiB0aGUgc3RhY2tcbiAgICAgICAgc3RkZXJyLndyaXRlKFxuICAgICAgICAgIGAgICAgJHtzdGFjay50b1N0cmluZygpLnRyaW1FbmQoKS5yZXBsYWNlKC9cXG4vZ20sICdcXG4gICAgJyl9XFxuYFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBzdGRlcnIud3JpdGUoJ1xcbicpO1xuICAgIH0sXG4gIH0sXG59O1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICBwcm94eVBsdWdpbigpLFxuICAgIHZpdGVTdGF0aWNDb3B5KHtcbiAgICAgIHRhcmdldHM6IFt7IHNyYzogJ25vZGVfbW9kdWxlcy9xdWFpbC13YXNtL3F1YWlsLndhc20nLCBkZXN0OiAnc3RhdGljJyB9XSxcbiAgICB9KSxcbiAgICBlc2J1aWxkQ29tbW9uanMoWydzcGlyZS1hcGknXSksXG4gIF0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGluY2x1ZGU6IFsnc3BpcmUtYXBpJywgJ0BiYWJ5bG9uanMvY29yZScsICdAYmFieWxvbmpzL2d1aScsICdAYmFieWxvbmpzL2luc3BlY3RvciddLFxuICB9LFxuXG4gIHNlcnZlcjoge1xuICAgIGhlYWRlcnM6IHtcbiAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgfSxcbiAgICBjbGllbnQ6IHtcbiAgICAgIG92ZXJsYXk6IHtcbiAgICAgICAgZXJyb3JzOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHBvcnQ6IDQxMDAsXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgYXNzZXRzRGlyICAgIDogJ3N0YXRpYycsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIC8vIG1hbnVhbENodW5rcyhpZCwgeyBnZXRNb2R1bGVJbmZvIH0pIHtcbiAgICAgICAgLy8gICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpKSB7XG4gICAgICAgIC8vICAgICBpZiAoaWQuaW5jbHVkZXMoJ0BiYWJ5bG9uanMvY29yZScpKSB7XG4gICAgICAgIC8vICAgICAgIHJldHVybiAnQGJhYnlsb25qcy9jb3JlJztcbiAgICAgICAgLy8gICAgIH1cblxuICAgICAgICAvLyAgICAgaWYgKGlkLmluY2x1ZGVzKCdAYmFieWxvbmpzL2d1aS1lZGl0b3InKSkge1xuICAgICAgICAvLyAgICAgICByZXR1cm4gJ0BiYWJ5bG9uanMvZ3VpLWVkaXRvcic7XG4gICAgICAgIC8vICAgICB9XG5cbiAgICAgICAgLy8gICAgIGlmIChpZC5pbmNsdWRlcygnQGJhYnlsb25qcy9ndWknKSkge1xuICAgICAgICAvLyAgICAgICByZXR1cm4gJ0BiYWJ5bG9uanMvZ3VpJztcbiAgICAgICAgLy8gICAgIH1cblxuICAgICAgICAvLyAgICAgaWYgKGlkLmluY2x1ZGVzKCdAYmFieWxvbmpzL2luc3BlY3RvcicpKSB7XG4gICAgICAgIC8vICAgICAgIHJldHVybiAnQGJhYnlsb25qcy9pbnNwZWN0b3InO1xuICAgICAgICAvLyAgICAgfVxuXG4gICAgICAgIC8vICAgICByZXR1cm4gaWQudG9TdHJpbmcoKS5zcGxpdCgnbm9kZV9tb2R1bGVzLycpWzFdLnNwbGl0KCcvJylbMF0udG9TdHJpbmcoKTtcbiAgICAgICAgLy8gICB9XG4gICAgICAgIC8vICAgY29uc3QgbWF0Y2ggPSAvLipcXC5zdHJpbmdzXFwuKFxcdyspXFwuanMvLmV4ZWMoaWQpO1xuICAgICAgICAvLyAgIGlmIChtYXRjaCkge1xuICAgICAgICAvLyAgICAgY29uc3QgbGFuZ3VhZ2UgPSBtYXRjaFsxXTsgLy8gZS5nLiBcImVuXCJcbiAgICAgICAgLy8gICAgIGNvbnN0IGRlcGVuZGVudEVudHJ5UG9pbnRzID0gW107XG5cbiAgICAgICAgLy8gICAgIC8vIHdlIHVzZSBhIFNldCBoZXJlIHNvIHdlIGhhbmRsZSBlYWNoIG1vZHVsZSBhdCBtb3N0IG9uY2UuIFRoaXNcbiAgICAgICAgLy8gICAgIC8vIHByZXZlbnRzIGluZmluaXRlIGxvb3BzIGluIGNhc2Ugb2YgY2lyY3VsYXIgZGVwZW5kZW5jaWVzXG4gICAgICAgIC8vICAgICBjb25zdCBpZHNUb0hhbmRsZSA9IG5ldyBTZXQoZ2V0TW9kdWxlSW5mbyhpZCkuZHluYW1pY0ltcG9ydGVycyk7XG5cbiAgICAgICAgLy8gICAgIGZvciAoY29uc3QgbW9kdWxlSWQgb2YgaWRzVG9IYW5kbGUpIHtcbiAgICAgICAgLy8gICAgICAgY29uc3QgeyBpc0VudHJ5LCBkeW5hbWljSW1wb3J0ZXJzLCBpbXBvcnRlcnMgfSA9XG4gICAgICAgIC8vICAgICAgICAgZ2V0TW9kdWxlSW5mbyhtb2R1bGVJZCk7XG4gICAgICAgIC8vICAgICAgIGlmIChpc0VudHJ5IHx8IGR5bmFtaWNJbXBvcnRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAvLyAgICAgICAgIGRlcGVuZGVudEVudHJ5UG9pbnRzLnB1c2gobW9kdWxlSWQpO1xuICAgICAgICAvLyAgICAgICB9XG5cbiAgICAgICAgLy8gICAgICAgZm9yIChjb25zdCBpbXBvcnRlcklkIG9mIGltcG9ydGVycykge1xuICAgICAgICAvLyAgICAgICAgIGlkc1RvSGFuZGxlLmFkZChpbXBvcnRlcklkKTtcbiAgICAgICAgLy8gICAgICAgfVxuICAgICAgICAvLyAgICAgfVxuXG4gICAgICAgIC8vICAgICBpZiAoZGVwZW5kZW50RW50cnlQb2ludHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIC8vICAgICAgIHJldHVybiBgJHtcbiAgICAgICAgLy8gICAgICAgICBkZXBlbmRlbnRFbnRyeVBvaW50c1swXS5zcGxpdCgnLycpLnNsaWNlKC0xKVswXS5zcGxpdCgnLicpWzBdXG4gICAgICAgIC8vICAgICAgIH0uc3RyaW5ncy4ke2xhbmd1YWdlfWA7XG4gICAgICAgIC8vICAgICB9XG4gICAgICAgIC8vICAgICAvLyBGb3IgbXVsdGlwbGUgZW50cmllcywgd2UgcHV0IGl0IGludG8gYSBcInNoYXJlZFwiIGNodW5rXG4gICAgICAgIC8vICAgICBpZiAoZGVwZW5kZW50RW50cnlQb2ludHMubGVuZ3RoID4gMSkge1xuICAgICAgICAvLyAgICAgICByZXR1cm4gYHNoYXJlZC5zdHJpbmdzLiR7bGFuZ3VhZ2V9YDtcbiAgICAgICAgLy8gICAgIH1cbiAgICAgICAgLy8gICB9XG4gICAgICAgIC8vIH0sXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiAnc3RhdGljL2pzL2Vxc2FnZS1bbmFtZV0uW2hhc2hdLmpzJyxcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6ICdzdGF0aWMvanMvZXFzYWdlLVtuYW1lXS5baGFzaF0uanMnLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHRhcmdldCAgIDogJ2VzbmV4dCcsXG4gICAgbWluaWZ5ICAgOiAnZXNidWlsZCcsXG4gICAgc291cmNlbWFwOiB0cnVlLCAvLyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nLFxuICB9LFxuICB3b3JrZXI6IHtcbiAgICBmb3JtYXQ6ICdlcycsXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgYnVmZmVyOiAnYnVmZmVyLycsXG4gICAgICB1dGlsICA6ICd1dGlsLycsXG4gICAgICAnQGJqcyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvYmpzJyksXG4gICAgICAnQCcgICA6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMnKSxcbiAgICB9LFxuICB9LFxuICBjc3M6IHtcbiAgICBwcmVwcm9jZXNzb3JPcHRpb25zOiB7XG4gICAgICBzY3NzOiB7XG4gICAgICAgIC4uLnNpbGVuY2VTb21lU2Fzc0RlcHJlY2F0aW9uV2FybmluZ3MsXG4gICAgICB9LFxuICAgICAgc2Fzczoge1xuICAgICAgICAuLi5zaWxlbmNlU29tZVNhc3NEZXByZWNhdGlvbldhcm5pbmdzLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICBkZWZpbmU6IHtcbiAgICAncHJvY2Vzcy5lbnYnOiB7fSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE2UCxTQUFTLG9CQUFvQjtBQUMxUixPQUFPLGVBQWU7QUFDdEIsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHNCQUFzQjtBQUwvQixJQUFNLG1DQUFtQztBQU96QyxRQUFRLElBQUksK0JBQStCO0FBQzNDLElBQU0sUUFBUSxVQUFVLGtCQUFrQixDQUFDLENBQUM7QUFFNUMsU0FBUyxzQkFBc0IsU0FBUyxTQUFTO0FBQy9DLFNBQU8sQ0FBQyxLQUFLLEtBQUssU0FBUztBQUN6QixVQUFNLFNBQVMsSUFBSSxRQUFRLGNBQWM7QUFFekMsUUFBSSxDQUFDLFFBQVE7QUFDWCxVQUFJLFVBQVUsS0FBSyxFQUFFLGdCQUFnQixhQUFhLENBQUM7QUFDbkQsYUFBTyxJQUFJLElBQUksb0NBQW9DO0FBQUEsSUFDckQ7QUFFQSxXQUFPLElBQUksUUFBUTtBQUNuQixVQUFNLGFBQWEsT0FBTyxXQUFXLFNBQVMsSUFDMUMsU0FDQSxVQUFVLE1BQU07QUFFcEIsVUFBTTtBQUFBLE1BQ0o7QUFBQSxNQUNBO0FBQUEsTUFDQSxFQUFFLFFBQVEsR0FBRyxVQUFVLEdBQUcsT0FBTyxJQUFJLGNBQWMsTUFBTSxRQUFRLE1BQU07QUFBQSxNQUN2RSxDQUFDLFVBQVU7QUFDVCxnQkFBUSxNQUFNLGdCQUFnQixLQUFLO0FBQ25DLFlBQUksVUFBVSxLQUFLLEVBQUUsZ0JBQWdCLGFBQWEsQ0FBQztBQUNuRCxZQUFJLElBQUksZ0JBQWdCLE1BQU0sT0FBTyxLQUFLLE1BQU0sRUFBRTtBQUFBLE1BQ3BEO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRjtBQUVBLFNBQVMsY0FBYztBQUNyQixTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixnQkFBZ0IsUUFBUTtBQUN0QixhQUFPLFlBQVk7QUFBQSxRQUNqQjtBQUFBLFFBQ0Esc0JBQXNCLGVBQWU7QUFBQSxVQUNuQyxjQUFjO0FBQUEsVUFDZCxRQUFjO0FBQUEsUUFDaEIsQ0FBQztBQUFBLE1BQ0g7QUFFQSxhQUFPLFlBQVk7QUFBQSxRQUNqQjtBQUFBLFFBQ0Esc0JBQXNCLFdBQVc7QUFBQSxVQUMvQixjQUFjO0FBQUEsVUFDZCxRQUFjO0FBQUEsUUFDaEIsQ0FBQztBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGO0FBRUEsSUFBTSxxQ0FBcUM7QUFBQSxFQUN6QyxTQUFTO0FBQUEsRUFDVCxRQUFTO0FBQUEsSUFDUCxLQUFLLFNBQVMsU0FBUztBQUNyQixZQUFNLEVBQUUsT0FBTyxJQUFJO0FBQ25CLFlBQU0sT0FBTyxRQUFRLFFBQVE7QUFDN0IsWUFBTSxTQUNILFFBQVEsVUFBVSxTQUFTLFNBQVksUUFBUSxVQUFVO0FBRTVELFVBQUksUUFBUSxhQUFhO0FBQ3ZCLFlBQ0UsUUFBUTtBQUFBLFVBQ047QUFBQSxRQUNGLEdBQ0E7QUFFQTtBQUFBLFFBQ0Y7QUFDQSxlQUFPLE1BQU0sY0FBYztBQUFBLE1BQzdCO0FBQ0EsYUFBTyxNQUFNLFlBQVksT0FBTztBQUFBLENBQUk7QUFFcEMsVUFBSSxTQUFTLFFBQVc7QUFFdEIsZUFBTyxNQUFNO0FBQUEsR0FBTSxLQUFLLElBQUk7QUFBQSxDQUFLO0FBQUEsTUFDbkM7QUFFQSxVQUFJLFVBQVUsUUFBVztBQUV2QixlQUFPO0FBQUEsVUFDTCxPQUFPLE1BQU0sU0FBUyxFQUFFLFFBQVEsRUFBRSxRQUFRLFFBQVEsUUFBUSxDQUFDO0FBQUE7QUFBQSxRQUM3RDtBQUFBLE1BQ0Y7QUFFQSxhQUFPLE1BQU0sSUFBSTtBQUFBLElBQ25CO0FBQUEsRUFDRjtBQUNGO0FBRUEsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sWUFBWTtBQUFBLElBQ1osZUFBZTtBQUFBLE1BQ2IsU0FBUyxDQUFDLEVBQUUsS0FBSyxzQ0FBc0MsTUFBTSxTQUFTLENBQUM7QUFBQSxJQUN6RSxDQUFDO0FBQUEsSUFDRCxnQkFBZ0IsQ0FBQyxXQUFXLENBQUM7QUFBQSxFQUMvQjtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLGFBQWEsbUJBQW1CLGtCQUFrQixzQkFBc0I7QUFBQSxFQUNwRjtBQUFBLEVBRUEsUUFBUTtBQUFBLElBQ04sU0FBUztBQUFBLE1BQ1AsK0JBQStCO0FBQUEsSUFDakM7QUFBQSxJQUNBLFFBQVE7QUFBQSxNQUNOLFNBQVM7QUFBQSxRQUNQLFFBQVE7QUFBQSxNQUNWO0FBQUEsSUFDRjtBQUFBLElBQ0EsTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFdBQWU7QUFBQSxJQUNmLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFxRE4sZ0JBQWdCO0FBQUEsUUFDaEIsZ0JBQWdCO0FBQUEsTUFDbEI7QUFBQSxJQUNGO0FBQUEsSUFDQSxRQUFXO0FBQUEsSUFDWCxRQUFXO0FBQUEsSUFDWCxXQUFXO0FBQUE7QUFBQSxFQUNiO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixRQUFRO0FBQUEsRUFDVjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsTUFBUTtBQUFBLE1BQ1IsUUFBUSxLQUFLLFFBQVEsa0NBQVcsU0FBUztBQUFBLE1BQ3pDLEtBQVEsS0FBSyxRQUFRLGtDQUFXLEtBQUs7QUFBQSxJQUN2QztBQUFBLEVBQ0Y7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILHFCQUFxQjtBQUFBLE1BQ25CLE1BQU07QUFBQSxRQUNKLEdBQUc7QUFBQSxNQUNMO0FBQUEsTUFDQSxNQUFNO0FBQUEsUUFDSixHQUFHO0FBQUEsTUFDTDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixlQUFlLENBQUM7QUFBQSxFQUNsQjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
