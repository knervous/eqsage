const CracoSwcPlugin = require('craco-swc');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');
const TerserPlugin = require('terser-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
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

          const terserPlugin = config.optimization.minimizer.find(m => m instanceof TerserPlugin);
          if (terserPlugin) {
            terserPlugin.options.minimizer.implementation = TerserPlugin.swcMinify;
            delete terserPlugin.options.minimizer.options.warnings;
          }
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
