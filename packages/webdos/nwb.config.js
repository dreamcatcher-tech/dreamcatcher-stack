const path = require('path')

module.exports = {
  type: 'react-component',
  npm: {
    esModules: true,
    umd: false,
  },
  webpack: {
    extra: {
      node: { fs: 'empty', child_process: 'empty' },
    },
    aliases: {
      react: path.resolve('./node_modules/react'),
    },
  },
}
