const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const path = require('path')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

/**
 Makes a web bundle with no externals.
 Used for checking the size of the complete web bundled interblock + dos.

 2021-07-27 time: 57sec size: 1.56MiB  no faker, no json-schema-faker
 */

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: `dosBrowserSumo.js`,
    library: {
      type: 'commonjs-module',
    },
  },
  target: 'web',
  mode: 'production',
  plugins: [new BundleAnalyzerPlugin(), new CleanWebpackPlugin()],
  resolve: {
    fallback: {
      fs: false,
      child_process: false,
      // TODO browserify ora completely, to remove these patches ?
      readline: require.resolve('readline-browserify'),
      crypto: false,
      os: require.resolve('os-browserify/browser'),
      path: require.resolve('path-browserify'),
    },
  },
  optimization: {
    minimize: true,
    mangleExports: 'size',
    nodeEnv: 'production',
    usedExports: true,
  },
}
