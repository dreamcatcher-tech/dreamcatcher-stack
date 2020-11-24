module.exports = function (wallaby) {
  return {
    files: [
      './index.js',
      'w*/**/*.js*',
      '**/sampleFile.txt',
      '!**/node_modules',
      '!**/*.test.js',
      '!**/.serverless',
      '!**/dist',
    ],

    tests: ['w*/**/*.test.js', '!**/node_modules', '!**/aws*.test.js'],

    env: {
      type: 'node',
    },
    testFramework: 'jest',
    // trace: true,
  }
}
