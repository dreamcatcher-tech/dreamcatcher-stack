const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const path = require('path')
const nodeExternals = require('webpack-node-externals')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const WebpackObfuscator = require('webpack-obfuscator')
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')

const highPerformance = {
  optionsPreset: 'low-obfuscation',
  // controlFlowFlattening: false,
  // debugProtection: false,
  // debugProtectionInterval: false,
  // identifierNamesGenerator: 'hexadecimal',
  // numbersToExpressions: false,
  // renameGlobals: false,
  // rotateStringArray: true,
  // selfDefending: false,
  // stringArrayEncoding: [],
  // stringArrayWrappersCount: 1,
  // stringArrayWrappersChainedCalls: true,
  // stringArrayWrappersParametersMaxCount: 2,
  // stringArrayWrappersType: 'variable',
  // stringArrayThreshold: 0.75,
  // unicodeEscapeSequence: false,
  stringArrayIndexShift: true,
  shuffleStringArray: true,
  stringArray: true,
  splitStrings: true,
  simplify: true,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  compact: true,
  disableConsoleOutput: false,
  log: true,
  transformObjectKeys: true,
  ignoreRequireImports: true,
  target: 'node',
}

// external dependencies cannot use a function to generate their string in webpack
// const { dependencies } = require('./package.json')
// highPerformance.reservedStrings = Object.keys(dependencies)
// highPerformance.reservedStrings.push('path', 'util', 'assert')
module.exports = {
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: `interblock.js`,
    // library: 'interblock',
    // libraryTarget: 'umd',
    // library: 'interblock',
    library: {
      name: 'interblock',
      type: 'umd',
      umdNamedDefine: true,
    },
    globalObject: 'this', // else defaults to 'self' and fails in nodejs environment
  },
  externalsPresets: { node: true },
  // target: 'node16.17',
  externals: [nodeExternals({ modulesFromFile: true })],
  mode: 'production',
  devtool: false,
  plugins: [
    new CleanWebpackPlugin(),
    // new NodePolyfillPlugin(), // didn't appear to make a difference
    // new BundleAnalyzerPlugin(),
    new WebpackObfuscator(highPerformance),
  ],
  // stats: { errorDetails: true },
  optimization: {
    minimize: true,
    mangleExports: 'size',
    nodeEnv: 'production',
  },
}
