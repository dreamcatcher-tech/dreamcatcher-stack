import { Interblock } from '../../../w015-models'

const createBase = async (ioConsistency, sqsPool) => {
  const baseAddressPromise = tapConsistency(ioConsistency)
  triggerIgnition(sqsPool)
  const baseAddress = await baseAddressPromise
  return baseAddress
}
const triggerIgnition = (sqsPool) => {
  const igniter = Interblock.getIgniter()
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

export { createBase }
