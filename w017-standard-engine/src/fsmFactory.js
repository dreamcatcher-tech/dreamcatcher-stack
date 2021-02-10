const assert = require('assert')
const { ioQueueFactory } = require('../../w003-queue')
const { interblockModel, addressModel, txModel } = require('../../w015-models')
const { isolateFactory } = require('./services/isolateFactory')
const { cryptoFactory } = require('./services/cryptoFactory')
const { consistencyFactory } = require('./services/consistencyFactory')
const { increasorConfig } = require('./configs/increasorConfig')
const { poolConfig } = require('./configs/poolConfig')
const { receiveConfig } = require('./configs/receiveConfig')
const { transmitConfig } = require('./configs/transmitConfig')

const { pure } = require('../../w001-xstate-direct')

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

  const pool = poolConfig(ioCrypto, ioConsistency)
  const poolProcessor = async (payload) => {
    assert(interblockModel.isModel(payload))
    const action = { type: 'POOL_INTERBLOCK', payload }
    const { machine, config } = pool
    const result = await pure(action, machine, config)
    return result
  }
  ioPool.setProcessor(poolProcessor)

  const increasor = increasorConfig(ioCrypto, ioConsistency, ioIsolate)
  const ioIncreaseProcessor = async (payload) => {
    assert(addressModel.isModel(payload))
    const action = { type: 'INCREASE_CHAIN', payload }
    const { machine, config } = increasor
    const result = await pure(action, machine, config)
    return result
  }
  ioIncrease.setProcessor(ioIncreaseProcessor)

  const receiver = receiveConfig(ioConsistency)
  const ioReceiveProcessor = async (payload) => {
    assert(txModel.isModel(payload))
    const action = { type: 'RECEIVE_INTERBLOCK', payload }
    const { machine, config } = receiver
    const result = await pure(action, machine, config)
    return result
  }
  ioReceive.setProcessor(ioReceiveProcessor)

  const transmitter = transmitConfig(ioConsistency)
  const ioTransmitProcessor = async (payload) => {
    assert(interblockModel.isModel(payload))
    const action = { type: 'TRANSMIT_INTERBLOCK', payload }
    const { machine, config } = transmitter
    const result = await pure(action, machine, config)
    return result
  }
  ioTransmit.setProcessor(ioTransmitProcessor)

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
