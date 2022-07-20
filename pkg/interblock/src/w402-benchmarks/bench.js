import Benchmark from 'benchmark'
import { assert } from 'chai'
import { Interpulse, apps } from '../index.mjs'
import {
  Network,
  Provenance,
  Validators,
  Pulse,
  Dmz,
  Keypair,
} from '../w008-ipld'
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
  const {
    crm: { reducer, ...crm },
  } = apps
  const { dpkgPath } = await engine.publish('dpkgCrm', crm)
  return engine
}
const install = async (engine) => {
  const dpkgPath = 'dpkgCrm'
  await engine.add(dpkgPath)
}

const crmSetup = async () => {
  const engine = await publish()
  await install(engine)
  const crmActions = await engine.actions('/crm/customers')
  return crmActions
}
// const crmActions = await crmSetup()
let custNo = 100
const addCustomer = async () => {
  await crmActions.add({ formData: { custNo, name: 'test name 1' } })
  custNo++
}

let id = 0
const network = await Network.createRoot()
const dmz = Dmz.create({ network })
const keypair = await Keypair.generate('bench')
const publicKeys = [keypair.publicKey]
const validators = Validators.create(publicKeys)
const provenance = Provenance.createGenesis(dmz, validators)
let pulse = await Pulse.create(provenance)
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
  // .add('publish', {
  //   defer: true,
  //   fn: async (deferred) => {
  //     const shell = await publish()
  //     await shell.shutdown()
  //     deferred.resolve()
  //   },
  // })
  // .add('install', {
  //   defer: true,
  //   fn: async (deferred) => {
  //     const shell = await publish()
  //     await install(shell)
  //     await shell.shutdown()
  //     deferred.resolve()
  //   },
  // })
  // .add('add customer', {
  //   defer: true,
  //   fn: async (deferred) => {
  //     await addCustomer()
  //     deferred.resolve()
  //   },
  // })
  .add('block making', {
    defer: true,
    fn: async (deferred) => {
      await makePulse()
      deferred.resolve()
    },
  })
  .add('unsigned block making', {
    defer: true,
    fn: async (deferred) => {
      await makeUnsigned()
      deferred.resolve()
    },
  })
  .on('cycle', (event) => {
    console.log(String(event.target))
  })
  .run({ async: false })

const makePulse = async () => {
  stateCounter++
  pulse = await pulse.generateSoftPulse()
  const state = pulse.getState().setMap({ stateCounter })
  pulse = pulse.setState(state)
  const provenance = await pulse.provenance.crush()
  const signature = await keypair.sign(provenance)
  pulse = pulse.addSignature(keypair.publicKey, signature)
  pulse = await pulse.crush()
  assert(pulse.isVerified())
}
const makeUnsigned = async () => {
  stateCounter++
  const state = pulse.getState().setMap({ stateCounter })
  pulse = pulse.setState(state)
  pulse = await pulse.crush()
}

makeUnsigned()
