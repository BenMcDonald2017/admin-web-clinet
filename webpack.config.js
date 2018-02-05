/* eslint-disable import/no-extraneous-dependencies, no-console */
module.exports = {
  devtool: 'source-map',
  externals: [/aws-sdk/, /electron/],
  module: {
    rules: [{
      test: /\.js$/,
      exclude: /(node_modules|bower_components)/,
      use: {
        loader: 'babel-loader?cacheDirectory=true',
        options: {
          presets: ['@babel/preset-env'],
          plugins: [
            require('@babel/plugin-proposal-object-rest-spread'),
            require('@babel/plugin-proposal-optional-chaining'),
          ],
        },
      },
    }],
  },
}
