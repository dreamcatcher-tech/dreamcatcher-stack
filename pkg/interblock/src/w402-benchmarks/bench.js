import Benchmark from 'benchmark'
import { assert } from 'chai'
import { effectorFactory } from '../..'
import Debug from 'debug'
const debug = Debug('interblock:benchmarks')
const suite = new Benchmark.Suite()

Debug.enable('*benchmarks')

const coldPing = async () => {
  const shell = await effectorFactory()
  const payload = { test: 'ping' }
  const reply = await shell.ping('.', payload)
  assert.deepEqual(reply, payload)
  await shell.metro.settle()
}
const hotShell = await effectorFactory()

const hotPing = async () => {
  const payload = { test: 'ping' }
  const reply = await hotShell.ping('.', payload)
  assert.deepEqual(reply, payload)
}

suite
  .add('boot', {
    defer: true,
    fn: async (deferred) => {
      const shell = await effectorFactory()
      await new Promise((r) => setTimeout(r, 1000))
      await shell.metro.settle()
      deferred.resolve()
    },
  })
  .add('cold ping', {
    defer: true,
    fn: async (deferred) => {
      await coldPing()
      deferred.resolve()
    },
  })
  .add('hot ping', {
    defer: true,
    fn: async (deferred) => {
      await hotPing()
      deferred.resolve()
    },
  })
  .on('cycle', (event) => {
    console.log(String(event.target))
  })
  .run({ async: false })
