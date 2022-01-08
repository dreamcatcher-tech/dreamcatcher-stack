import Benchmark from 'benchmark'
import { assert } from 'chai'
import { effectorFactory, apps } from '../..'
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

const publish = async () => {
  const shell = await effectorFactory('crm')
  const { crm } = apps
  const { dpkgPath } = await shell.publish('dpkgCrm', crm.installer)
  return shell
}

const install = async (shell) => {
  const dpkgPath = 'dpkgCrm'
  await shell.install(dpkgPath, 'crm')
}

const addCustomer = async (shell) => {
  const crmActions = await shell.actions('/crm/customers')
  await crmActions.add({ formData: { custNo: 100, name: 'test name 1' } })
  //   await crmActions.add({ formData: { custNo: 101, name: 'test name 2' } })
}

suite
  .add('boot', {
    defer: true,
    fn: async (deferred) => {
      const shell = await effectorFactory()
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
  .add('publish', {
    defer: true,
    fn: async (deferred) => {
      await publish()
      deferred.resolve()
    },
  })
  .add('install', {
    defer: true,
    fn: async (deferred) => {
      const shell = await publish()
      await install(shell)
      deferred.resolve()
    },
  })
  .add('add customer', {
    defer: true,
    fn: async (deferred) => {
      const shell = await publish()
      await install(shell)
      await addCustomer(shell)
      deferred.resolve()
    },
  })
  .on('cycle', (event) => {
    console.log(String(event.target))
  })
  .run({ async: false })
