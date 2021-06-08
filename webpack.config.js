const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const path = require('path')
const nodeExternals = require('webpack-node-externals')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const WebpackObfuscator = require('webpack-obfuscator')

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
  // unicodeEscapeSequence: false,
  stringArrayThreshold: 0.75,
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

module.exports = {
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: `interblock.js`,
    library: {
      name: 'interblock',
      type: 'umd',
      umdNamedDefine: true,
    },
    globalObject: 'this', // else defaults to 'self' and fails in nodejs environment
  },
  externalsPresets: { node: true },
  target: 'node16.17',
  externals: [nodeExternals({ modulesFromFile: true }), 'ws', 'cli-truncate'],
  mode: 'production',
  devtool: false,
  plugins: [
    // new BundleAnalyzerPlugin(),
    new CleanWebpackPlugin(),
    new WebpackObfuscator(highPerformance),
  ],
  optimization: {
    minimize: true,
    mangleExports: 'size',
    nodeEnv: 'production',
  },
  resolve: {
    // stop warnings when bundling
    fallback: {
      'sodium-native': false,
      bufferutil: false,
      'utf-8-validate': false,
      'cli-truncate': false,
    },
  },
}
