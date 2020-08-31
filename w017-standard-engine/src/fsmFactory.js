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

  ioPool.setProcessor(async (payload) => {
    assert(interblockModel.isModel(payload))
    const action = { type: 'POOL_INTERBLOCK', payload }
    const pool = poolConfig(ioCrypto, ioConsistency)
    const result = await thread(action, pool)
    return result
  })
  ioIncrease.setProcessor(async (payload) => {
    assert(addressModel.isModel(payload))
    const action = { type: 'INCREASE_CHAIN', payload }
    const increasor = increasorConfig(ioCrypto, ioConsistency, ioIsolate)
    const result = await thread(action, increasor)
    return result
  })
  ioReceive.setProcessor(async (payload) => {
    assert(txModel.isModel(payload))
    const action = { type: 'RECEIVE_INTERBLOCK', payload }
    const receiver = receiveConfig(ioConsistency)
    const result = await thread(action, receiver)
    return result
  })
  ioTransmit.setProcessor(async (payload) => {
    assert(interblockModel.isModel(payload))
    const action = { type: 'TRANSMIT_INTERBLOCK', payload }
    const transmitter = transmitConfig(ioConsistency)
    const result = await thread(action, transmitter)
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
