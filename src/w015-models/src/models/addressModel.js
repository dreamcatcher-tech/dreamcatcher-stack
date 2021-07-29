import assert from 'assert'
import * as crypto from '../../../w012-crypto'
import { standardize } from '../modelUtils'
import { integrityModel } from './integrityModel'
import { addressSchema } from '../schemas/modelSchemas'

const addressModel = standardize({
  schema: addressSchema,
  create: (integrity = integrityModel.create()) => {
    let status = `UNKNOWN`
    // TODO do not use integrityModel if one of the predetermined types
    if (integrity === `GENESIS`) {
      // the source of randomness in genesis block creation
      status = `GENESIS_${crypto.generateNonce()}`
      integrity = integrityModel.create('GENESIS')
    } else if (integrity === 'LOOPBACK') {
      status = 'LOOPBACK'
      integrity = integrityModel.create('LOOPBACK')
    } else if (integrity === 'ROOT') {
      status = 'ROOT'
      integrity = integrityModel.create('ROOT')
    } else if (integrity === 'INVALID') {
      status = 'INVALID'
      integrity = integrityModel.create('INVALID')
    } else if (typeof integrity === 'string') {
      if (integrity.startsWith('TEST')) {
        integrity = integrityModel.create('TEST').hash
      }
      const possibleIntegrity = integrityModel.create(integrity)
      if (possibleIntegrity.hash.length === integrity.length) {
        // TODO use a regex tester for chainIds
        const hash = integrity
        integrity = integrityModel.clone({
          ...possibleIntegrity,
          hash,
        })
        status = 'RESOLVED'
      } else {
        integrity = possibleIntegrity
      }
    } else if (!integrity.isUnknown()) {
      status = `RESOLVED`
    }
    assert(integrityModel.isModel(integrity))
    return addressModel.clone({ chainId: integrity, status })
  },
  logicize: (instance) => {
    const { chainId, status } = instance
    const getChainId = () => {
      if (status === 'LOOPBACK') {
        return 'LOOPBACK'
      }
      if (status === 'ROOT') {
        return 'ROOT'
      }
      if (status !== 'RESOLVED') {
        throw new Error(
          `Tried to get chainId on address with status: ${status}`
        )
      }
      return chainId.hash
    }
    // TODO broaden isResolved to cover root and loopback cases
    const isRoot = () => status === 'ROOT'
    const isLoopback = () => status === 'LOOPBACK'
    const isGenesis = () => status.startsWith('GENESIS_')
    const isUnknown = () => status === 'UNKNOWN'
    const isResolved = () => status === 'RESOLVED'
    const isInvalid = () => status === 'INVALID'

    return {
      getChainId,
      isRoot,
      isLoopback,
      isGenesis,
      isUnknown,
      isResolved,
      isInvalid,
    }
  },
})

export { addressModel }
