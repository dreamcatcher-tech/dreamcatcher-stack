const { blockModel, interblockModel } = require('../../../w015-models')

const createBase = async (ioConsistency, sqsPool) => {
  triggerIgnition(sqsPool)
  const baseAddress = await tapConsistency(ioConsistency)
  return baseAddress
}
const triggerIgnition = async (sqsPool) => {
  const dummyBlock = await blockModel.create()
  const igniter = interblockModel.create(dummyBlock)
  sqsPool.push(igniter)
}

const tapConsistency = (ioConsistency) => {
  let baseAddressFound
  const promise = new Promise((resolve) => (baseAddressFound = resolve))
  const unsubscribe = ioConsistency.subscribe(async (action, queuePromise) => {
    if (action.type === 'UNLOCK') {
      const { block } = action.payload
      await queuePromise
      baseAddressFound(block.provenance.getAddress())
      unsubscribe()
    }
  })
  return promise
}

module.exports = { createBase }
