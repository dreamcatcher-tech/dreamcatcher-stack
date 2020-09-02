const BundleAnalyzerPlugin = require('webpack-bundle-analyzer')
  .BundleAnalyzerPlugin
const path = require('path')
const nodeExternals = require('webpack-node-externals')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

module.exports = {
  entry: {
    streamProcessor: './src/streamProcessor.js',
  },
  target: 'node',
  output: {
    path: path.join(__dirname, './dist'),
    filename: `[name].js`,
    libraryTarget: 'umd',
  },
  externals: [
    nodeExternals({
      modulesDir: '../w201-lambda-layer/layerBase/nodejs/node_modules',
    }),
    /aws-sdk/,
  ],
  mode: 'development', // need to keep assert() able to throw
  resolve: { mainFields: ['main', 'module'] }, // require('pad') needs to prioritize module over main
  plugins: [
    new CleanWebpackPlugin(),
    // new BundleAnalyzerPlugin()
  ],
}
