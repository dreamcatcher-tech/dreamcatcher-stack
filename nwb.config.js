module.exports = {
  type: 'web-module',
  npm: {
    esModules: true,
    cjs: true,
    umd: false,
  },
  babel: {
    presets: [
      [
        'minify',
        { builtIns: false, keepFnName: false, mangle: { topLevel: true } },
      ],
    ],
    config: (config) => {
      config.comments = false // strip comments out of minified code
      return config
    },
  },
}
