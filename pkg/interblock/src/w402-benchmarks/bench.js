import Benchmark from 'benchmark'
import { assert } from 'chai'
import { Interpulse, apps } from '../index.mjs'
import { Pulse, Dmz, Keypair } from '../w008-ipld'
import Debug from 'debug'
const debug = Debug('interblock:benchmarks')
const suite = new Benchmark.Suite()

Debug.enable('*benchmarks')

const coldPing = async () => {
  const engine = await Interpulse.createCI()
  const payload = { test: 'ping' }
  const reply = await engine.ping('.', payload)
  assert.deepEqual(reply, payload)
  await engine.shutdown()
}
const engine = await Interpulse.createCI()

const hotPing = async () => {
  const payload = { test: 'ping' }
  const reply = await engine.ping('.', payload)
  assert.deepEqual(reply, payload)
}

const publish = async () => {
  const engine = await Interpulse.createCI()
  const { crm } = apps
  const { dpkgPath } = await engine.publish('dpkgCrm', crm)
  return engine
}
const install = async (engine) => {
  const dpkgPath = 'dpkgCrm'
  await engine.install(dpkgPath, 'crm')
}

const crmSetup = async () => {
  const engine = await publish()
  await install(engine)
  const crmActions = await engine.actions('/crm/customers')
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
let pulse = Pulse.create(dmz)
let stateCounter = 0
suite
  .add('boot', {
    defer: true,
    fn: async (deferred) => {
      const engine = await Interpulse.createCI()
      await engine.shutdown()
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
      const state = pulse.getDmz().state.update({ stateCounter })
      const nextDmz = pulse.getDmz().update({ state })
      const unsignedBlock = blockProducer.generateUnsigned(nextDmz, pulse)
      const { integrity } = unsignedBlock.provenance
      const signature = await signatureProducer.sign(integrity, keypair)
      pulse = blockProducer.assemble(unsignedBlock, signature)
      deferred.resolve()
    },
  })
  .add('unsigned block making', {
    fn: () => {
      stateCounter++
      const state = pulse.getDmz().state.update({ stateCounter })
      const nextDmz = pulse.getDmz().update({ state })
      pulse = blockProducer.generateUnsigned(nextDmz, pulse)
    },
  })
  .on('cycle', (event) => {
    console.log(String(event.target))
  })
  .run({ async: false })
