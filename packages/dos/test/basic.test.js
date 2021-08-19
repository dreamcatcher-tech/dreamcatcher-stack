import process from 'process'
import bin from '../src/bin'

describe.skip('basic', () => {
  test('ls', async () => {
    // NOT WORKING
    process.stdin.write('ls')
    await new Promise((cb) => setTimeout(cb, 2000))
  })
})
