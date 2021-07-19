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
  },
}
