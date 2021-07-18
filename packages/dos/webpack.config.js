const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const path = require('path')
const nodeExternals = require('webpack-node-externals')
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

const externals = nodeExternals({ modulesFromFile: true, allowlist: ['ora'] })
// const externals = nodeExternals({ modulesFromFile: true })

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
  devtool: 'source-map', // TODO make sourcemap so can debug
  plugins: [
    //   new BundleAnalyzerPlugin(),
    new CleanWebpackPlugin(),
    new NodePolyfillPlugin({}),
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
