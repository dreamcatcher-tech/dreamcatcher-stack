const { Machine, assign } = require('xstate')
global.Machine = Machine // allow copy paste of machines into visualizer
global.assign = assign
const assert = require('assert')
const { ioQueueFactory } = require('../../w003-queue')
const { interblockModel, addressModel, txModel } = require('../../w015-models')
const { thread } = require('./execution/thread')
const { isolateFactory } = require('./services/isolateFactory')
const { cryptoFactory } = require('./services/cryptoFactory')
const { consistencyFactory } = require('./services/consistencyFactory')
const { increasorConfig } = require('./configs/increasorConfig')
const { poolConfig } = require('./configs/poolConfig')
const { receiveConfig } = require('./configs/receiveConfig')
const { transmitConfig } = require('./configs/transmitConfig')

const fsmFactory = () => {
  const ioIsolate = ioQueueFactory('ioIsolate')
  const ioCrypto = ioQueueFactory('ioCrypto')
  const ioConsistency = ioQueueFactory('ioConsistency')
  const ioPool = ioQueueFactory('ioPool', interblockModel)
  const ioIncrease = ioQueueFactory('ioIncrease', addressModel)
  const ioReceive = ioQueueFactory('ioReceive', txModel)
  const ioTransmit = ioQueueFactory('ioTransmit', interblockModel)

  ioIsolate.setProcessor(isolateFactory())
  ioCrypto.setProcessor(cryptoFactory())
  ioConsistency.setProcessor(consistencyFactory())

  const poolMachine = poolConfig(ioCrypto, ioConsistency)
  ioPool.setProcessor(async (payload) => {
    assert(interblockModel.isModel(payload))
    const action = { type: 'POOL_INTERBLOCK', payload }
    const result = await thread(action, poolMachine)
    return result
  })
  const increasorMachine = increasorConfig(ioCrypto, ioConsistency, ioIsolate)
  ioIncrease.setProcessor(async (payload) => {
    assert(addressModel.isModel(payload))
    const action = { type: 'INCREASE_CHAIN', payload }
    const result = await thread(action, increasorMachine)
    return result
  })
  const receiverMachine = receiveConfig(ioConsistency)
  ioReceive.setProcessor(async (payload) => {
    assert(txModel.isModel(payload))
    const action = { type: 'RECEIVE_INTERBLOCK', payload }
    const result = await thread(action, receiverMachine)
    return result
  })
  const transmitterMachine = transmitConfig(ioConsistency)
  ioTransmit.setProcessor(async (payload) => {
    assert(interblockModel.isModel(payload))
    const action = { type: 'TRANSMIT_INTERBLOCK', payload }
    const result = await thread(action, transmitterMachine)
    return result
  })

  return {
    ioIsolate,
    ioCrypto,
    ioConsistency,
    ioPool,
    ioIncrease,
    ioReceive,
    ioTransmit,
  }
}

module.exports = { fsmFactory }
