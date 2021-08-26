import { assert } from 'chai/index.mjs'
import { ioQueueFactory } from '../../w003-queue'
import { interblockModel, addressModel, txModel } from '../../w015-models'
import { isolateFactory } from './services/isolateFactory'
import { cryptoFactory } from './services/cryptoFactory'
import { consistencyFactory } from './services/consistencyFactory'
import { increasorConfig } from './configs/increasorConfig'
import { poolConfig } from './configs/poolConfig'
import { receiveConfig } from './configs/receiveConfig'
import { transmitConfig } from './configs/transmitConfig'
import { pure } from '../../w001-xstate-direct'

const fsmFactory = () => {
  const ioIsolate = ioQueueFactory('ioIsolate')
  const ioCrypto = ioQueueFactory('ioCrypto')
  const ioConsistency = ioQueueFactory('ioConsistency')
  const ioPool = ioQueueFactory('ioPool', interblockModel)
  const ioIncrease = ioQueueFactory('ioIncrease', addressModel)
  const ioReceive = ioQueueFactory('ioReceive', txModel)
  const ioTransmit = ioQueueFactory('ioTransmit', interblockModel)

  ioCrypto.setProcessor(cryptoFactory())
  ioConsistency.setProcessor(consistencyFactory())
  ioIsolate.setProcessor(isolateFactory(ioConsistency))

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

export { fsmFactory }
