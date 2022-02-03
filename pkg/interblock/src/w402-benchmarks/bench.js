import Benchmark from 'benchmark'
import { assert } from 'chai'
import { effectorFactory, apps } from '../..'
import { Block, Dmz, Keypair } from '../w015-models'
import { blockProducer, signatureProducer } from '../w016-producers'
import Debug from 'debug'
const debug = Debug('interblock:benchmarks')
const suite = new Benchmark.Suite()

Debug.enable('*benchmarks')

const coldPing = async () => {
  const shell = await effectorFactory()
  const payload = { test: 'ping' }
  const reply = await shell.ping('.', payload)
  assert.deepEqual(reply, payload)
  await shell.shutdown()
}
const hotShell = await effectorFactory('hot')

const hotPing = async () => {
  const payload = { test: 'ping' }
  const reply = await hotShell.ping('.', payload)
  assert.deepEqual(reply, payload)
}

const publish = async (id = 'app') => {
  const shell = await effectorFactory(id)
  const { crm } = apps
  const { dpkgPath } = await shell.publish('dpkgCrm', crm.installer)
  return shell
}

const install = async (shell) => {
  const dpkgPath = 'dpkgCrm'
  await shell.install(dpkgPath, 'crm')
}

const crmSetup = async () => {
  const shell = await publish('crm')
  await install(shell)
  const crmActions = await shell.actions('/crm/customers')
  return crmActions
}
const crmActions = await crmSetup()
let custNo = 100
const addCustomer = async () => {
  await crmActions.add({ formData: { custNo, name: 'test name 1' } })
  custNo++
}

let id = 0
const keypair = Keypair.create('bench')
const dmz = Dmz.create({ validators: keypair.getValidatorEntry() })
let block = Block.create(dmz)
let stateCounter = 0
suite
  .add('boot', {
    defer: true,
    fn: async (deferred) => {
      const shell = await effectorFactory(`id-${id++}`)
      shell.shutdown()
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
      const shell = await publish()
      await shell.shutdown()
      deferred.resolve()
    },
  })
  .add('install', {
    defer: true,
    fn: async (deferred) => {
      const shell = await publish()
      await install(shell)
      await shell.shutdown()
      deferred.resolve()
    },
  })
  .add('add customer', {
    defer: true,
    fn: async (deferred) => {
      await addCustomer()
      deferred.resolve()
    },
  })
  .add('block making', {
    defer: true,
    fn: async (deferred) => {
      stateCounter++
      const state = block.getDmz().state.update({ stateCounter })
      const nextDmz = block.getDmz().update({ state })
      const unsignedBlock = blockProducer.generateUnsigned(nextDmz, block)
      const { integrity } = unsignedBlock.provenance
      const signature = await signatureProducer.sign(integrity, keypair)
      block = blockProducer.assemble(unsignedBlock, signature)
      deferred.resolve()
    },
  })
  .add('unsigned block making', {
    fn: () => {
      stateCounter++
      const state = block.getDmz().state.update({ stateCounter })
      const nextDmz = block.getDmz().update({ state })
      block = blockProducer.generateUnsigned(nextDmz, block)
    },
  })
  .on('cycle', (event) => {
    console.log(String(event.target))
  })
  .run({ async: false })
