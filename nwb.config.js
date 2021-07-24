module.exports = {
  type: 'web-module',
  npm: {
    esModules: true,
    umd: {
      global: 'interblock',
      externals: {},
    },
  },
  webpack: {
    extra: {
      node: { fs: 'empty' },
    },
  },
}
