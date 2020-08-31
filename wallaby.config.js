module.exports = function (wallaby) {
  return {
    files: [
      'w*/**/*.js*',
      '**/sampleFile.txt',
      '!**/node_modules',
      '!**/*.test.js',
    ],

    tests: ['w*/**/*.test.js', '!**/node_modules', '!**/awsReal.test.js'],

    env: {
      type: 'node',
    },
    testFramework: 'jest',
    // trace: true,
    useWsl: true, // seems to be slower with this on.  Suspect zombie processes from this off.
  }
}
