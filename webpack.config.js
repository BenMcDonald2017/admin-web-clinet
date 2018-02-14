// eslint-disable-next-line
const webpack = require('webpack');

module.exports = {
  devtool: 'source-map',
  externals: [
    /aws-sdk/,
    /electron/,
  ],
  target: 'node',
  module: {
    loaders: [{
      test: /\.js$/i,
      loader: 'babel-loader',
      exclude: /node_modules/,
      query: {
        cacheDirectory: true,
        presets: [
          'es2017',
          'es2016',
          'es2015-node6',
        ],
        plugins: [
          'add-module-exports',
          'transform-class-properties',
          'transform-export-extensions',
          'transform-object-rest-spread',
        ],
      },
      rules: [{
        test: /\.js$/i,
        use: 'source-map-loader',
        enforce: 'pre',
      }],
    }],
  },
}
