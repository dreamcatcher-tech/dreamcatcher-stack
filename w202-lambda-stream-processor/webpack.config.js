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
  // externals: [
  //   /aws-sdk/,
  //   'ajv',
  //   'ansi-colors',
  //   'aws-xray-sdk',
  //   'clear',
  //   'cli-truncate',
  //   'columnify',
  //   'debug',
  //   'dotenv',
  //   'dynamodb-lock-client',
  //   'fast-json-stable-stringify',
  //   'immer',
  //   'is-circular',
  //   'node-object-hash',
  //   'object-hash',
  //   'pad',
  //   'pretty-bytes',
  //   'rimraf',
  //   'secure-random',
  //   'sodium-native',
  //   'sodium-plus',
  //   'supports-color',
  //   'tar',
  //   'uuid',
  //   'xstate',
  // ],
  mode: 'development', // need to keep assert() able to throw
  resolve: { mainFields: ['main', 'module'] }, // require('pad') needs to prioritize module over main
  plugins: [
    new CleanWebpackPlugin(),
    // new BundleAnalyzerPlugin()
  ],
}
