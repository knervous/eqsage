const CracoSwcPlugin = require('craco-swc');

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
  ],
  webpack: {
    plugins: {
      add   : [],
      remove: []
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
          buffer: require.resolve('buffer/'),
        },
      },
    },
  },
};
