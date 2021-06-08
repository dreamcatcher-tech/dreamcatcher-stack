const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const path = require('path')
const nodeExternals = require('webpack-node-externals')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: `dos.js`,
    library: {
      name: 'interblock',
      type: 'umd',
      umdNamedDefine: true,
    },
    globalObject: 'this', // else defaults to 'self' and fails in nodejs environment
  },
  externalsPresets: { node: true },
  target: 'node14.17',
  externals: [nodeExternals({ modulesFromFile: true })],
  mode: 'production',
  devtool: false, // TODO make sourcemap so can debug
  plugins: [
    //   new BundleAnalyzerPlugin(),
    new CleanWebpackPlugin(),
  ],
  optimization: {
    minimize: true,
    mangleExports: 'size',
    nodeEnv: 'production',
  },
}
