const BundleAnalyzerPlugin = require('webpack-bundle-analyzer')
  .BundleAnalyzerPlugin
const path = require('path')
const nodeExternals = require('webpack-node-externals')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const WebpackObfuscator = require('webpack-obfuscator')

const highPerformance = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  debugProtectionInterval: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: false,
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: false,
  shuffleStringArray: true,
  simplify: true,
  splitStrings: false,
  stringArray: true,
  stringArrayEncoding: [],
  stringArrayIndexShift: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 2,
  stringArrayWrappersType: 'variable',
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false,
}

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
  target: 'node',
  externalsPresets: { node: true },
  externals: [nodeExternals()],
  //   mode: 'development', // need to keep assert() able to throw
  mode: 'production', // need to keep assert() able to throw
  devtool: false,
  //   stats: {
  //     modules: false,
  //   },
  plugins: [
    new CleanWebpackPlugin(),
    // new BundleAnalyzerPlugin(),
    // new WebpackObfuscator(highPerformance),
  ],
  //   rules: [
  //     {
  //       test: /\.js$/,
  //       exclude: [path.resolve(__dirname, 'excluded_file_name.js')],
  //       enforce: 'post',
  //       use: {
  //         loader: WebpackObfuscator.loader,
  //         options: {},
  //       },
  //     },
  //   ],
  //   optimization: {
  //     minimize: true,
  //     mangleExports: 'size',
  //     nodeEnv: 'production',
  //   },
}
