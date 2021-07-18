const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const path = require('path-browserify')
const nodeExternals = require('webpack-node-externals')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const WebpackObfuscator = require('webpack-obfuscator')

const highPerformance = {
  optionsPreset: 'default',
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
  // ### modified options
  // stringArrayThreshold: 0.75,
  // stringArrayIndexShift: true,
  // shuffleStringArray: true,
  // stringArray: true,
  // splitStrings: true,
  simplify: true,
  // deadCodeInjection: true,
  // deadCodeInjectionThreshold: 0.4,
  compact: true,
  // disableConsoleOutput: false,
  // log: true,
  // transformObjectKeys: true,
  ignoreRequireImports: true,
  // target: 'node',
}

module.exports = {
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: `interblock.js`,
    library: {
      type: 'commonjs-module',
    },
  },
  // externalsPresets: { node: true },
  // target: 'node14.17',
  target: 'web',
  externals: [
    nodeExternals({ modulesFromFile: true, allowlist: ['json-schema-faker'] }),
  ],
  mode: 'production',
  devtool: false, // TODO make sourcemap so can debug
  plugins: [
    // new BundleAnalyzerPlugin(),
    new CleanWebpackPlugin(),
    new WebpackObfuscator(highPerformance),
  ],
  // resolve: {
  //   fallback: {
  //     // readline: require.resolve('readline-browserify'),
  //     path: require.resolve('path-browserify'),
  //   },
  // },
  optimization: {
    minimize: true,
    mangleExports: 'size',
    nodeEnv: 'production',
  },
}
