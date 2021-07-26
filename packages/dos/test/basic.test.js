const process = require('process')
describe.skip('basic', () => {
  test('ls', async () => {
    // NOT WORKING
    const bin = require('../src/bin')
    process.stdin.write('ls')
    await new Promise((cb) => setTimeout(cb, 2000))
  })
})
