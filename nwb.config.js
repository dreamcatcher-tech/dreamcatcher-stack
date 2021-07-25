module.exports = {
  type: 'web-module',
  npm: {
    cjs: true,
    esModules: false,
    umd: false,
  },
  babel: {
    presets: [
      [
        'minify',
        {
          builtIns: false,
          keepFnName: false,
          mangle: { topLevel: true },
          simplify: false, // conflicts with mangle if keep this in: https://github.com/babel/minify/issues/999
        },
      ],
    ],
    config: (config) => {
      config.comments = false // strip comments out of minified code
      return config
    },
  },
}
