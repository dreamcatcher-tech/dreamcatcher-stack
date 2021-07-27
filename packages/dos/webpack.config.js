const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const path = require('path')
const nodeExternals = require('webpack-node-externals')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const externals = nodeExternals({ modulesFromFile: true, allowlist: ['ora'] })

/**
 * Ora uses the readline module, which is unavailable in the browser.
 * This is the whole reason for having a webpack bundle that is built for the browser.
 *
 * All of ora must be included in the bundle, else the downstream bundler will attempt to
 * bundle ora its own way, and will not work instantly.
 *
 * Target must be set to 'web' or else webpack thinks that readline is a node
 * module which is available, so it makes no attempt to bundle using the fallbacks.
 *
 * Target 'web' causes the path and assert modules to be missing, so a fallback
 * is added here, as well as an install of 'assert' which needs no fallback as the
 * name is identical.
 */

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: `dosBrowser.js`,
    library: {
      type: 'commonjs-module',
    },
    // globalObject: 'this', // else defaults to 'self' and fails in nodejs environment
  },
  //   externalsPresets: { web: true },
  target: 'web',
  externals,
  mode: 'production',
  plugins: [
    //   new BundleAnalyzerPlugin(),
    new CleanWebpackPlugin(),
  ],
  resolve: {
    fallback: {
      readline: require.resolve('readline-browserify'),
    },
  },
  optimization: {
    minimize: true,
    mangleExports: 'size',
    nodeEnv: 'production',
  },
}
