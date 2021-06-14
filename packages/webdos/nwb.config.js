const path = require('path')
const nodeExternals = require('webpack-node-externals')
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin
module.exports = {
  type: 'react-component',
  npm: {
    esModules: true,
    umd: false,
  },
  webpack: {
    extra: {
      // externals: [nodeExternals({ modulesFromFile: true })],
      // plugins: [new NodePolyfillPlugin()],
      // plugins: [
      //   new BundleAnalyzerPlugin({
      //     generateStatsFile: true,
      //     analyzerMode: 'disabled',
      //   }),
      // ],
      node: { fs: 'empty', child_process: 'empty' },
    },
    aliases: {
      react: path.resolve('./node_modules/react'),
    },
  },
}
