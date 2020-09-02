module.exports = function (wallaby) {
  return {
    files: [
      'w*/**/*.js*',
      '**/sampleFile.txt',
      '!**/node_modules',
      '!**/*.test.js',
    ],

    tests: ['w*/**/*.test.js', '!**/node_modules', '!**/aws*.test.js'],

    env: {
      type: 'node',
    },
    testFramework: 'jest',
  }
}
