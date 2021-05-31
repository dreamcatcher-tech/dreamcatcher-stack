const BundleAnalyzerPlugin = require('webpack-bundle-analyzer')
  .BundleAnalyzerPlugin
const path = require('path')
const nodeExternals = require('webpack-node-externals')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const WebpackObfuscator = require('webpack-obfuscator')
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')

const highPerformance = {
  optionsPreset: 'low-obfuscation',
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false,
  debugProtectionInterval: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  ignoreRequireImports: true,
  log: false,
  numbersToExpressions: false,
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: false,
  shuffleStringArray: true,
  simplify: true,
  splitStrings: true,
  stringArray: true,
  stringArrayEncoding: [],
  stringArrayIndexShift: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 2,
  stringArrayWrappersType: 'variable',
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false,
  transformObjectKeys: true,
  target: 'node',
}

// external dependencies cannot use a function to generate their string in webpack
const { dependencies } = require('./package.json')
highPerformance.reservedStrings = Object.keys(dependencies)
highPerformance.reservedStrings.push('path', 'util')

module.exports = {
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: `interblock.js`,
    library: {
      name: 'interblock',
      type: 'umd',
    },
    globalObject: 'this', // else defaults to 'self' and fails in nodejs environment
  },
  externalsPresets: { web: true, node: true },
  externals: [nodeExternals({ modulesFromFile: true }), 'pad/dist/pad.umd'],
  mode: 'production',
  devtool: false,
  plugins: [
    new CleanWebpackPlugin(),
    new NodePolyfillPlugin(),
    // new BundleAnalyzerPlugin(),
    new WebpackObfuscator(highPerformance),
  ],
  optimization: {
    minimize: true,
    mangleExports: 'size',
    nodeEnv: 'production',
  },
}
