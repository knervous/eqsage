const CracoSwcPlugin = require('craco-swc');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');
const TerserPlugin = require('terser-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  devServer: (devServerConfig) => {
    // Enable CORS to allow the app to be loaded from different origins
    devServerConfig.headers = {
      'Access-Control-Allow-Origin': '*',
    };
    // devServerConfig.client.webSocketURL.port = 8082;
    // devServerConfig.client.webSocketURL.pathname = '/eqsage';

    // devServerConfig.client.webSocketURL = {
    //   // Adjust these options according to your setup
    //   hostname: 'localhost',
    //   pathname: '/ws', // Custom WebSocket path
    //   port    : 8082, // Vue app's port that proxies to the CRA app
    //   protocol: 'ws',
    // };

    // Other devServer customizations can go here

    return devServerConfig;
  },
  plugins: [
    {
      plugin : CracoSwcPlugin,
      options: {
        esbuildMinimizerOptions: {
          target: 'es2020',
          css   : true,
        },
      },
    },
    {
      plugin: {
        /** @param {{ webpackConfig: import('webpack').Configuration}} config */
        overrideWebpackConfig: ({ webpackConfig: config }) => {
          config.resolve.plugins = config.resolve.plugins.filter(
            plugin => !(plugin instanceof ModuleScopePlugin)
          );
          // Just make this local
          if (process.env.REACT_APP_LOCAL_DEV === 'true') {
            const terserPlugin = config.optimization.minimizer.find(m => m instanceof TerserPlugin);
            if (terserPlugin) {
              terserPlugin.options.minimizer.implementation = TerserPlugin.swcMinify;
              delete terserPlugin.options.minimizer.options.warnings;
            }
          }

          config.output.chunkFilename = 'static/js/eqsage-[name].[contenthash:8].chunk.js';
          config.output.filename = 'static/js/eqsage-[name].[contenthash:8].js';
          
          config.plugins.push(
            new CopyPlugin({
              patterns: [
                { from: 'node_modules/draco3dgltf/draco_encoder.wasm', to: 'static/js' },
                { from: 'node_modules/draco3dgltf/draco_decoder_gltf.wasm', to: 'static/js' },
              ],
            }),
          );
          config.module.rules.push({
            resourceQuery: /raw/,
            type         : 'asset/source',
          });
          return config;
        }
      }
    }
  ],
  webpack: {
    plugins: {
      add: [
      ],
      remove: [],
    },
    configure: {
      resolve: {
        fallback: {
          fs    : false,
          tls   : false,
          net   : false,
          path  : false,
          zlib  : false,
          http  : false,
          https : false,
          stream: false,
          crypto: false,
          assert: false,
          buffer: require.resolve('buffer/'),
          util  : require.resolve('util/'),
        },
      },
    },
  },
};
